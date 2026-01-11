import { Injectable, Logger } from '@nestjs/common';
import * as he from 'he';
import Tesseract from 'tesseract.js';

export interface ExtractedContent {
    fullText: string;
    chapters: ChapterData[];
    metadata: {
        title?: string;
        author?: string;
        pageCount?: number;
        language?: string;
    };
    extractionMethod?: 'text' | 'ocr';
    /**
     * Warnings about extraction quality or limitations.
     * Users should be notified about these issues.
     */
    extractionWarnings?: string[];
}

export enum ExtractionQuality {
    HIGH = 'high',         // Embedded TOC/bookmarks used
    MEDIUM = 'medium',     // Printed TOC parsed successfully
    LOW = 'low',           // Regex-based detection only
    FALLBACK = 'fallback', // Single "Full Book" chapter
}

export interface ChapterData {
    chapterNumber: number;
    title?: string;
    text: string;
    startPage?: number;
    endPage?: number;
}

interface TocEntry {
    title: string;
    pageNumber: number;
    chapterNumber?: number;
}

// Minimum characters per page to consider PDF as having extractable text
const MIN_CHARS_PER_PAGE = 100;

// Quality thresholds for OCR text detection
const MAX_AVG_WORD_LENGTH = 12; // Words longer than this suggest merged words
const MIN_SPACE_RATIO = 0.10; // At least 10% of characters should be spaces
const MAX_LONG_WORD_RATIO = 0.15; // Max 15% of words can be "long" (>15 chars)

@Injectable()
export class TextExtractionService {
    private readonly logger = new Logger(TextExtractionService.name);

    async extractFromPdf(buffer: Buffer): Promise<ExtractedContent> {
        // pdf-parse 1.x - CommonJS module with simple API
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);

        const metadata = {
            title: data.info?.Title,
            author: data.info?.Author,
            pageCount: data.numpages,
        };

        const fullText = this.cleanText(data.text);

        // Check if PDF has minimal/no text (likely scanned)
        const avgCharsPerPage = fullText.length / (metadata.pageCount || 1);
        const isLikelyScanned = avgCharsPerPage < MIN_CHARS_PER_PAGE;

        if (isLikelyScanned) {
            this.logger.log(
                `PDF appears to be scanned (${avgCharsPerPage.toFixed(0)} chars/page). Falling back to OCR...`,
            );
            return this.extractFromScannedPdf(buffer, metadata);
        }

        // Check if embedded text has poor OCR quality (merged words, garbled text)
        if (this.isPoorOcrQuality(fullText)) {
            this.logger.log(
                `PDF has embedded text but poor OCR quality. Re-running OCR for better results...`,
            );
            return this.extractFromScannedPdf(buffer, metadata);
        }

        // Track extraction quality and warnings
        const warnings: string[] = [];
        let extractionQuality: ExtractionQuality = ExtractionQuality.HIGH;

        // Try TOC-based chapter extraction first (most accurate - uses PDF bookmarks)
        let chapters = await this.extractChaptersFromToc(buffer, metadata.pageCount || 0);

        // If no embedded TOC, try parsing printed TOC from text (uses page numbers)
        if (chapters.length === 0 && metadata.pageCount) {
            this.logger.log('No embedded TOC. Trying to parse printed TOC from text...');
            chapters = this.extractChaptersFromPrintedToc(fullText, metadata.pageCount);

            if (chapters.length > 0) {
                extractionQuality = ExtractionQuality.MEDIUM;
                this.logger.log(`Extracted ${chapters.length} chapters using printed TOC`);
            }
        }

        // Fall back to regex-based detection (least accurate - pattern matching only)
        if (chapters.length === 0) {
            this.logger.log('No TOC found. Using regex-based chapter detection...');
            chapters = this.detectChaptersInText(fullText);

            if (chapters.length > 0) {
                extractionQuality = ExtractionQuality.LOW;
                warnings.push(
                    'Chapter detection used pattern matching only. Chapter boundaries may be inaccurate. ' +
                        'For best results, use a PDF with embedded bookmarks or a clear table of contents.',
                );
            }
        }

        // Ultimate fallback: single "Full Book" chapter
        let finalChapters: ChapterData[];
        if (chapters.length > 0) {
            finalChapters = chapters;
        } else {
            finalChapters = this.createDefaultChapter(fullText);
            extractionQuality = ExtractionQuality.FALLBACK;
            warnings.push(
                'Could not detect chapter structure in this PDF. The entire book has been extracted as a single chapter. ' +
                    'This may happen with scanned books, unusual formatting, or PDFs without a table of contents. ' +
                    'You can still generate episodes, but chapter selection will not be available.',
            );
        }

        this.logger.log(
            `Extraction complete: ${finalChapters.length} chapter(s), ${fullText.length} chars, quality: ${extractionQuality}`,
        );

        if (warnings.length > 0) {
            this.logger.warn(`Extraction warnings: ${warnings.join(' | ')}`);
        }

        return {
            fullText,
            chapters: finalChapters,
            metadata,
            extractionMethod: 'text',
            extractionWarnings: warnings.length > 0 ? warnings : undefined,
        };
    }

    /**
     * Extract chapters using PDF TOC/outline with page numbers.
     * This is more accurate than regex-based detection as it uses the
     * PDF's built-in table of contents structure.
     *
     * Handles edge cases:
     * - Chapters sharing the same page (uses regex to find exact split point)
     * - Nested TOC entries (flattens to chapter level)
     * - Missing page numbers (skips entry)
     */
    private async extractChaptersFromToc(buffer: Buffer, totalPages: number): Promise<ChapterData[]> {
        try {
            const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
            const loadingTask = pdfjs.getDocument({ data: buffer });
            const pdfDoc = await loadingTask.promise;

            // Extract TOC/outline from PDF
            const outline = await pdfDoc.getOutline();

            if (!outline || outline.length === 0) {
                this.logger.debug('PDF has no outline/TOC');
                return [];
            }

            // Parse outline entries and get page numbers
            const tocEntries = await this.parseTocEntries(pdfDoc, outline);

            if (tocEntries.length === 0) {
                this.logger.debug('Could not extract valid TOC entries');
                return [];
            }

            this.logger.log(`Found ${tocEntries.length} TOC entries`);

            // Extract text page-by-page for accurate splitting
            const pageTexts = await this.extractTextByPage(pdfDoc);

            // Split content based on TOC page numbers
            const chapters = this.splitTextByToc(tocEntries, pageTexts, totalPages);

            this.logger.log(`Extracted ${chapters.length} chapters from TOC`);

            return chapters;
        } catch (error) {
            this.logger.warn(`TOC extraction failed: ${error.message}`);
            return [];
        }
    }

    /**
     * Parse PDF outline entries recursively to extract TOC with page numbers.
     */
    private async parseTocEntries(pdfDoc: any, outline: any[], depth = 0): Promise<TocEntry[]> {
        const entries: TocEntry[] = [];
        let chapterCounter = 1;

        for (const item of outline) {
            try {
                // Get destination (page reference) for this outline item
                let pageNumber: number | null = null;

                if (item.dest) {
                    // Destination can be a name or array
                    const dest =
                        typeof item.dest === 'string'
                            ? await pdfDoc.getDestination(item.dest)
                            : item.dest;

                    if (dest && dest[0]) {
                        // dest[0] is a page reference object
                        const pageRef = dest[0];
                        pageNumber = await pdfDoc.getPageIndex(pageRef);
                    }
                }

                if (pageNumber !== null && pageNumber >= 0) {
                    const title = item.title?.trim() || `Chapter ${chapterCounter}`;

                    // Try to extract chapter number from title
                    const chapterMatch = title.match(/^(?:Chapter\s+)?(\d+)/i);
                    const extractedChapterNum = chapterMatch ? parseInt(chapterMatch[1]) : chapterCounter;

                    entries.push({
                        title,
                        pageNumber: pageNumber, // 0-indexed
                        chapterNumber: extractedChapterNum,
                    });

                    this.logger.debug(`TOC: "${title}" -> Page ${pageNumber + 1}`);
                    chapterCounter++;
                }

                // Process nested items (sub-chapters) - flatten them
                if (item.items && item.items.length > 0) {
                    const nestedEntries = await this.parseTocEntries(pdfDoc, item.items, depth + 1);
                    // Only include top-level chapters, skip sub-sections
                    if (depth === 0) {
                        // Nested items might be sub-chapters, we skip them for main chapter extraction
                    }
                }
            } catch (error) {
                this.logger.debug(`Failed to parse TOC entry: ${error.message}`);
            }
        }

        return entries;
    }

    /**
     * Extract text from each page of the PDF.
     */
    private async extractTextByPage(pdfDoc: any): Promise<string[]> {
        const pageTexts: string[] = [];
        const numPages = pdfDoc.numPages;

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            try {
                const page = await pdfDoc.getPage(pageNum);
                const textContent = await page.getTextContent();

                // Combine text items into page text
                const pageText = textContent.items.map((item: any) => item.str).join(' ');

                pageTexts.push(this.cleanText(pageText));
            } catch (error) {
                this.logger.debug(`Failed to extract text from page ${pageNum}: ${error.message}`);
                pageTexts.push('');
            }
        }

        return pageTexts;
    }

    /**
     * Split text content based on TOC page numbers.
     * Handles the edge case where multiple chapters start on the same page
     * by using regex to find the exact chapter heading position.
     */
    private splitTextByToc(tocEntries: TocEntry[], pageTexts: string[], totalPages: number): ChapterData[] {
        const chapters: ChapterData[] = [];

        // Sort entries by page number
        const sortedEntries = [...tocEntries].sort((a, b) => a.pageNumber - b.pageNumber);

        for (let i = 0; i < sortedEntries.length; i++) {
            const current = sortedEntries[i];
            const next = sortedEntries[i + 1];

            const startPage = current.pageNumber; // 0-indexed
            const endPage = next ? next.pageNumber : totalPages - 1;

            // Collect text from all pages in this chapter's range
            let chapterText = '';

            for (let pageIdx = startPage; pageIdx <= endPage; pageIdx++) {
                if (pageIdx < pageTexts.length) {
                    chapterText += pageTexts[pageIdx] + '\n\n';
                }
            }

            // Handle shared page case: if next chapter starts on same page as this one ends
            if (next && startPage === next.pageNumber) {
                // Both chapters share the same page - use regex to split
                chapterText = this.splitSharedPage(chapterText, current.title, next.title);
            } else if (next && endPage === next.pageNumber && endPage < pageTexts.length) {
                // This chapter ends on the same page where next chapter starts
                // Need to trim content after next chapter's heading
                const sharedPageText = pageTexts[endPage];
                const splitResult = this.findChapterSplitPoint(sharedPageText, next.title);

                if (splitResult.found) {
                    // Remove the shared page from chapter text, then add only the portion before next chapter
                    const textWithoutSharedPage = chapterText
                        .split('\n\n')
                        .slice(0, -1)
                        .join('\n\n');
                    chapterText = textWithoutSharedPage + '\n\n' + splitResult.beforeHeading;
                }
            }

            chapterText = chapterText.trim();

            if (chapterText.length > 0) {
                chapters.push({
                    chapterNumber: current.chapterNumber || i + 1,
                    title: current.title,
                    text: chapterText,
                    startPage: startPage + 1, // Convert to 1-indexed for output
                    endPage: endPage + 1,
                });
            }
        }

        return chapters;
    }

    /**
     * Split text when two chapters share the same starting page.
     */
    private splitSharedPage(pageText: string, currentTitle: string, nextTitle: string): string {
        const splitResult = this.findChapterSplitPoint(pageText, nextTitle);

        if (splitResult.found) {
            return splitResult.beforeHeading;
        }

        // If we can't find the split point, return the whole text
        // (the next chapter extraction will handle finding its start)
        return pageText;
    }

    /**
     * Find the position of a chapter heading in text to split at.
     * Uses flexible matching to handle variations in how titles appear.
     */
    private findChapterSplitPoint(
        text: string,
        chapterTitle: string,
    ): { found: boolean; beforeHeading: string; afterHeading: string } {
        // Create regex patterns to find the chapter heading
        // Handle common formats: "Chapter X", "Chapter X: Title", "LAW X", "X. Title"
        const escapedTitle = chapterTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const patterns = [
            // Exact title match
            new RegExp(`(.*?)(?=\\b${escapedTitle}\\b)`, 'is'),
            // "Chapter N" or "CHAPTER N" format
            new RegExp(`(.*?)(?=\\bChapter\\s+\\d+\\b)`, 'i'),
            // "LAW N" or "Law N" format (with or without space due to OCR)
            new RegExp(`(.*?)(?=\\bLAW\\s*\\d+\\b)`, 'i'),
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const splitPos = match[1].length;
                return {
                    found: true,
                    beforeHeading: text.slice(0, splitPos).trim(),
                    afterHeading: text.slice(splitPos).trim(),
                };
            }
        }

        return {
            found: false,
            beforeHeading: text,
            afterHeading: '',
        };
    }

    /**
     * Extract chapters by parsing printed TOC from the text content.
     * This handles PDFs that have a printed table of contents but no embedded bookmarks.
     *
     * Strategy:
     * 1. Find the printed TOC section in the text
     * 2. Parse TOC entries to extract chapter titles and page numbers
     * 3. Estimate character positions based on page numbers
     * 4. Split text at estimated positions, refining with heading detection
     */
    private extractChaptersFromPrintedToc(fullText: string, pageCount: number): ChapterData[] {
        // Step 1: Find and parse printed TOC entries
        const tocEntries = this.parsePrintedTocEntries(fullText);

        if (tocEntries.length < 2) {
            this.logger.debug(
                `Found only ${tocEntries.length} printed TOC entries - not enough for chapter splitting`,
            );
            return [];
        }

        this.logger.log(`Found ${tocEntries.length} printed TOC entries`);

        // Step 2: Estimate characters per page
        const charsPerPage = fullText.length / pageCount;
        this.logger.debug(`Estimated ${charsPerPage.toFixed(0)} characters per page`);

        // Step 3: Find the end of TOC section (where actual content begins)
        const tocEndPosition = this.findTocEndPosition(fullText, tocEntries);
        const contentText = fullText.slice(tocEndPosition);
        const contentStartPage = Math.floor(tocEndPosition / charsPerPage);

        this.logger.debug(
            `TOC ends at position ${tocEndPosition}, content starts around page ${contentStartPage + 1}`,
        );

        // Step 4: Split content at chapter boundaries
        const chapters = this.splitTextByPrintedToc(contentText, tocEntries, charsPerPage, contentStartPage);

        // Filter out chapters with insufficient content
        const MIN_CHAPTER_LENGTH = 1000;
        const validChapters = chapters.filter((ch) => ch.text.length >= MIN_CHAPTER_LENGTH);

        this.logger.log(
            `Extracted ${validChapters.length} valid chapters from printed TOC (filtered ${chapters.length - validChapters.length} short entries)`,
        );

        return validChapters;
    }

    /**
     * Parse printed TOC entries from text.
     * Supports multiple formats:
     * - "Chapter 1 Overview 23" (title followed by page number)
     * - "Chapter 1: Overview ... 23" (with dots)
     * - "1. Overview 23" (numbered list)
     * - "LAW 1 Never Outshine the Master 1" (law format)
     */
    private parsePrintedTocEntries(text: string): TocEntry[] {
        const entries: TocEntry[] = [];

        // Find TOC section - look for "contents" heading
        const tocMatch = text.match(/\b(contents|table\s+of\s+contents)\b/i);
        if (!tocMatch) {
            this.logger.debug('No TOC section found in text');
            return [];
        }

        // Extract a reasonable section after "contents" (up to ~10000 chars or until we hit main content)
        const tocStart = tocMatch.index!;
        const tocSection = text.slice(tocStart, tocStart + 15000);

        // Patterns for TOC entries with page numbers
        // Format: "Chapter X Title ... PageNum" or "LAW X Title PageNum"
        const patterns = [
            // "Chapter 1 Title 23" or "Chapter 1: Title 23" or "Chapter 1 Title ... 23"
            /^(Chapter\s+(\d+))[\s:\.]+([^\d\n]+?)\s+(\d{1,4})\s*$/gim,
            // "CHAPTER 1 TITLE 23"
            /^(CHAPTER\s+(\d+))[\s:\.]+([^\d\n]+?)\s+(\d{1,4})\s*$/gim,
            // "LAW 1 Title 23" or "LAW1 Title 23"
            /^(LAW\s*(\d+))[\s:\.]+([^\d\n]+?)\s+(\d{1,4})\s*$/gim,
            // "1. Title 23" or "1 Title 23" (simple numbered)
            /^(\d+)[\.\s]+([A-Z][^\d\n]+?)\s+(\d{1,4})\s*$/gm,
        ];

        for (const pattern of patterns) {
            let match: RegExpExecArray | null;
            const regex = new RegExp(pattern);

            while ((match = regex.exec(tocSection)) !== null) {
                let chapterNum: number;
                let title: string;
                let pageNum: number;

                if (pattern.source.startsWith('^(\\d+)')) {
                    // Simple numbered format: group 1 = number, group 2 = title, group 3 = page
                    chapterNum = parseInt(match[1]);
                    title = match[2].trim();
                    pageNum = parseInt(match[3]);
                } else {
                    // Chapter/LAW format: group 2 = number, group 3 = title, group 4 = page
                    chapterNum = parseInt(match[2]);
                    title = match[3].trim();
                    pageNum = parseInt(match[4]);
                }

                // Clean up title - remove trailing dots and excess whitespace
                title = title.replace(/\.{2,}\s*$/, '').replace(/\s+/g, ' ').trim();

                // Skip if title looks like a section number (e.g., "1.1 Introduction")
                if (/^\d+\.\d+/.test(title)) {
                    continue;
                }

                // Skip duplicates
                if (entries.some((e) => e.chapterNumber === chapterNum)) {
                    continue;
                }

                // Validate page number is reasonable (1-9999)
                if (pageNum >= 1 && pageNum <= 9999 && title.length > 0) {
                    entries.push({
                        title: title,
                        pageNumber: pageNum,
                        chapterNumber: chapterNum,
                    });
                }
            }

            // If we found entries with this pattern, don't try other patterns
            if (entries.length >= 3) {
                break;
            }
        }

        // Sort by chapter number
        entries.sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));

        return entries;
    }

    /**
     * Find where the TOC section ends and main content begins.
     * Looks for the first chapter heading after the TOC.
     */
    private findTocEndPosition(text: string, tocEntries: TocEntry[]): number {
        if (tocEntries.length === 0) return 0;

        // The first chapter in TOC tells us what to look for
        const firstChapter = tocEntries[0];
        const firstChapterNum = firstChapter.chapterNumber || 1;
        const firstChapterTitle = firstChapter.title;

        // Create patterns to find the actual chapter heading (not TOC entry)
        const escapedTitle = firstChapterTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Look for chapter heading WITHOUT a page number following it
        // This distinguishes actual headings from TOC entries
        const patterns = [
            // "Chapter 1" or "CHAPTER 1" at start of line, followed by title or newline (no page number)
            new RegExp(
                `^Chapter\\s+${firstChapterNum}\\b(?!.*\\d{1,4}\\s*$)[\\s:]*(?:${escapedTitle})?`,
                'im',
            ),
            // Just the title at start of line (for formats without "Chapter X" prefix)
            new RegExp(`^${escapedTitle}\\s*$`, 'im'),
            // "1.1" section number (indicates we're in chapter content)
            new RegExp(`^${firstChapterNum}\\.1\\b`, 'im'),
        ];

        // Start searching after "contents" heading
        const contentsMatch = text.match(/\bcontents\b/i);
        const searchStart = contentsMatch ? contentsMatch.index! + 500 : 0;

        let earliestMatch = text.length;

        for (const pattern of patterns) {
            const searchText = text.slice(searchStart);
            const match = searchText.match(pattern);

            if (match && match.index !== undefined) {
                const absolutePos = searchStart + match.index;
                if (absolutePos < earliestMatch) {
                    earliestMatch = absolutePos;
                }
            }
        }

        // If no match found, estimate based on page count
        // TOC typically ends around page 10-20 for most books
        if (earliestMatch === text.length && tocEntries.length > 0) {
            const firstContentPage = tocEntries[0].pageNumber;
            const charsPerPage = text.length / (tocEntries[tocEntries.length - 1].pageNumber + 50);
            earliestMatch = Math.min(text.length * 0.1, firstContentPage * charsPerPage);
        }

        return Math.max(0, earliestMatch);
    }

    /**
     * Split text content using parsed TOC page numbers.
     * Uses character position estimation with heading-based refinement.
     */
    private splitTextByPrintedToc(
        contentText: string,
        tocEntries: TocEntry[],
        charsPerPage: number,
        contentStartPage: number,
    ): ChapterData[] {
        const chapters: ChapterData[] = [];

        // Sort entries by page number
        const sortedEntries = [...tocEntries].sort((a, b) => a.pageNumber - b.pageNumber);

        for (let i = 0; i < sortedEntries.length; i++) {
            const current = sortedEntries[i];
            const next = sortedEntries[i + 1];

            // Estimate character position for this chapter's start
            const pageOffset = current.pageNumber - contentStartPage - 1;
            const estimatedStart = Math.max(0, Math.floor(pageOffset * charsPerPage));

            // Estimate end position (start of next chapter, or end of text)
            let estimatedEnd: number;
            if (next) {
                const nextPageOffset = next.pageNumber - contentStartPage - 1;
                estimatedEnd = Math.floor(nextPageOffset * charsPerPage);
            } else {
                estimatedEnd = contentText.length;
            }

            // Refine positions by looking for actual chapter headings
            const refinedStart = this.refineChapterStart(contentText, current, estimatedStart, charsPerPage);
            let refinedEnd = estimatedEnd;

            if (next) {
                refinedEnd = this.refineChapterStart(contentText, next, estimatedEnd, charsPerPage);
            }

            // Extract chapter text
            const chapterText = contentText.slice(refinedStart, refinedEnd).trim();

            if (chapterText.length > 0) {
                chapters.push({
                    chapterNumber: current.chapterNumber || i + 1,
                    title: current.title,
                    text: chapterText,
                    startPage: current.pageNumber,
                    endPage: next ? next.pageNumber - 1 : undefined,
                });
            }
        }

        return chapters;
    }

    /**
     * Refine chapter start position by searching for the actual heading.
     * Searches within a window around the estimated position.
     */
    private refineChapterStart(
        text: string,
        tocEntry: TocEntry,
        estimatedPos: number,
        charsPerPage: number,
    ): number {
        // Search window: 2 pages before and after estimated position
        const windowSize = Math.floor(charsPerPage * 2);
        const searchStart = Math.max(0, estimatedPos - windowSize);
        const searchEnd = Math.min(text.length, estimatedPos + windowSize);
        const searchText = text.slice(searchStart, searchEnd);

        const chapterNum = tocEntry.chapterNumber || 1;
        const escapedTitle = tocEntry.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Patterns to find the chapter heading
        const patterns = [
            // "Chapter X" or "CHAPTER X" followed by title
            new RegExp(`Chapter\\s+${chapterNum}\\b[\\s:]*${escapedTitle.slice(0, 20)}`, 'i'),
            // Just "Chapter X" at start of line
            new RegExp(`^Chapter\\s+${chapterNum}\\b`, 'im'),
            // LAW format
            new RegExp(`^LAW\\s*${chapterNum}\\b`, 'im'),
            // Title alone (capitalized)
            new RegExp(`^${escapedTitle.slice(0, 30)}`, 'im'),
            // Section number like "1.1"
            new RegExp(`^${chapterNum}\\.1\\b`, 'im'),
        ];

        for (const pattern of patterns) {
            const match = searchText.match(pattern);
            if (match && match.index !== undefined) {
                return searchStart + match.index;
            }
        }

        // No heading found, return estimated position
        return estimatedPos;
    }

    async extractFromScannedPdf(
        buffer: Buffer,
        existingMetadata?: ExtractedContent['metadata'],
    ): Promise<ExtractedContent> {
        this.logger.log('Starting OCR extraction for scanned PDF...');

        try {
            // Use pdf.js to render PDF pages to images, then OCR each page
            const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

            // Load PDF document
            const loadingTask = pdfjs.getDocument({ data: buffer });
            const pdfDoc = await loadingTask.promise;
            const numPages = pdfDoc.numPages;

            this.logger.log(`Processing ${numPages} pages with OCR...`);

            const pageTexts: string[] = [];

            // Process pages in batches to manage memory
            const batchSize = 5;
            for (let batchStart = 1; batchStart <= numPages; batchStart += batchSize) {
                const batchEnd = Math.min(batchStart + batchSize - 1, numPages);
                const batchPromises: Promise<string>[] = [];

                for (let pageNum = batchStart; pageNum <= batchEnd; pageNum++) {
                    batchPromises.push(this.ocrPdfPage(pdfDoc, pageNum));
                }

                const batchResults = await Promise.all(batchPromises);
                pageTexts.push(...batchResults);

                this.logger.log(`OCR progress: ${batchEnd}/${numPages} pages processed`);
            }

            const fullText = this.cleanText(pageTexts.join('\n\n'));
            const chapters = this.detectChaptersInText(fullText);

            // OCR extraction has inherent quality limitations
            const warnings: string[] = [
                'This PDF was processed using OCR (optical character recognition). ' +
                    'Text accuracy may vary, especially for complex layouts, images, or handwritten content.',
            ];

            const finalChapters = chapters.length > 0 ? chapters : this.createDefaultChapter(fullText);

            if (chapters.length === 0) {
                warnings.push(
                    'Could not detect chapter structure. The book has been extracted as a single chapter.',
                );
            }

            this.logger.log(
                `OCR extraction complete: ${finalChapters.length} chapter(s), ${fullText.length} chars`,
            );

            return {
                fullText,
                chapters: finalChapters,
                metadata: {
                    ...existingMetadata,
                    pageCount: numPages,
                },
                extractionMethod: 'ocr',
                extractionWarnings: warnings,
            };
        } catch (error) {
            this.logger.error('OCR extraction failed', error);
            throw new Error(`OCR extraction failed: ${error.message}`);
        }
    }

    private async ocrPdfPage(pdfDoc: any, pageNum: number): Promise<string> {
        try {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 }); // Higher scale = better OCR

            // Create canvas for rendering
            const { createCanvas } = await import('canvas');
            const canvas = createCanvas(viewport.width, viewport.height);
            const context = canvas.getContext('2d');

            // Render PDF page to canvas
            await page.render({
                canvasContext: context,
                viewport: viewport,
            }).promise;

            // Convert canvas to buffer for Tesseract
            const imageBuffer = canvas.toBuffer('image/png');

            // Perform OCR
            const result = await Tesseract.recognize(imageBuffer, 'eng', {
                logger: () => {}, // Silence progress logs
            });

            return result.data.text;
        } catch (error) {
            this.logger.warn(`Failed to OCR page ${pageNum}: ${error.message}`);
            return ''; // Return empty string for failed pages
        }
    }

    async extractFromEpub(buffer: Buffer): Promise<ExtractedContent> {
        // Dynamic import for epub-parser
        const epubModule = await import('epub-parser');
        const EPub = epubModule.default || epubModule;
        const epub = await EPub.parse(buffer);

        const metadata = {
            title: epub.metadata?.title,
            author: epub.metadata?.creator,
            language: epub.metadata?.language,
        };

        const chapters: ChapterData[] = [];
        let fullText = '';

        if (epub.sections && Array.isArray(epub.sections)) {
            for (let i = 0; i < epub.sections.length; i++) {
                const section = epub.sections[i];
                const text = this.cleanText(
                    this.stripHtml(section.htmlString || section.content || ''),
                );

                chapters.push({
                    chapterNumber: i + 1,
                    title: section.title || `Chapter ${i + 1}`,
                    text,
                });

                fullText += text + '\n\n';
            }
        }

        return {
            fullText: fullText.trim(),
            chapters: chapters.length > 0 ? chapters : this.createDefaultChapter(fullText),
            metadata,
            extractionMethod: 'text',
        };
    }

    private detectChaptersInText(text: string): ChapterData[] {
        // Patterns for chapter detection - match at start of line
        // Captures: full match, chapter number, optional title
        // Supports: "Chapter X", "CHAPTER X", "LAW X", "Law X", etc.
        const chapterPatterns = [
            /^(Chapter\s+(\d+))(?:[:\.\s]+(.*))?$/gim,
            /^(CHAPTER\s+(\d+))(?:[:\.\s]+(.*))?$/gim,
            /^(LAW\s*(\d+))(?:[:\.\s]+(.*))?$/gim,  // "LAW 1" or "LAW1" (OCR often removes space)
            /^(Law\s*(\d+))(?:[:\.\s]+(.*))?$/gim,
        ];

        interface ChapterMatch {
            chapterNumber: number;
            title: string;
            position: number;
            matchLength: number;
            fullMatch: string;
        }

        const chapterMatches: ChapterMatch[] = [];
        let matches: RegExpExecArray | null;

        for (const pattern of chapterPatterns) {
            const regex = new RegExp(pattern);
            while ((matches = regex.exec(text)) !== null) {
                const chapterNum = parseInt(matches[2]);
                let title = matches[3]?.trim() || `Chapter ${chapterNum}`;

                // Clean up title - remove trailing page numbers (e.g., "Cryptographic Tools 52")
                title = title.replace(/\s+\d{1,4}\s*$/, '').trim();
                if (!title) {
                    title = `Chapter ${chapterNum}`;
                }

                // Skip if this looks like a mid-sentence reference rather than a chapter heading
                // Chapter headings typically have capitalized titles like "Overview", "User Authentication"
                // References look like "Chapter 1 listed a number..." or "Chapter 4. The matrix..."
                const firstWord = title.split(/\s+/)[0];
                if (firstWord && firstWord.length > 2) {
                    // If first word starts lowercase or is a common verb, it's likely a sentence
                    const looksLikeSentence =
                        /^[a-z]/.test(firstWord) || // starts with lowercase
                        /^(the|a|an|is|are|was|were|has|have|had|will|would|could|should|can|may|might|must|listed|includes|describes|explains|provides|contains|discusses|presents|covers|shows|demonstrates|illustrates|introduces|examines|explores|considers|addresses|deals|focuses|offers|gives|takes|makes|uses|also|then|this|that|these|those|it|its|such|each|both|all|any|some|most|many|few|several|various|other|another|more|less|further|additional|following|preceding|above|below|previous|next|first|second|third|last|final|later|earlier|recently|currently|already|still|yet|now|here|there|where|when|how|why|what|which|who|whom|whose)$/i.test(
                            firstWord,
                        );
                    if (looksLikeSentence) {
                        this.logger.debug(
                            `Skipping mid-sentence reference: "Chapter ${chapterNum} ${title.slice(0, 30)}..."`,
                        );
                        continue;
                    }
                }

                chapterMatches.push({
                    chapterNumber: chapterNum,
                    title,
                    position: matches.index,
                    matchLength: matches[0].length,
                    fullMatch: matches[0],
                });
            }
            if (chapterMatches.length > 0) break;
        }

        if (chapterMatches.length === 0) {
            return [];
        }

        // Filter out table of contents entries and index references
        const filteredMatches = this.filterChapterMatches(text, chapterMatches);

        if (filteredMatches.length === 0) {
            return [];
        }

        // Sort by position in text
        filteredMatches.sort((a, b) => a.position - b.position);

        // Deduplicate by chapter number, keeping only the first occurrence
        const seenChapters = new Set<number>();
        const uniqueMatches = filteredMatches.filter((match) => {
            if (seenChapters.has(match.chapterNumber)) {
                return false;
            }
            seenChapters.add(match.chapterNumber);
            return true;
        });

        // Split text at actual chapter positions
        const chapters = this.splitTextAtChapterPositions(text, uniqueMatches);

        // Filter out chapters with insufficient content (likely TOC entries that slipped through)
        // Real chapters should have at least 2500 characters of content
        // (TOC entries with brief summaries are typically 100-500 chars between headings)
        const MIN_CHAPTER_CONTENT_LENGTH = 2500;
        const validChapters = chapters.filter((chapter) => {
            if (chapter.text.length < MIN_CHAPTER_CONTENT_LENGTH) {
                this.logger.debug(
                    `Filtered out chapter ${chapter.chapterNumber} with insufficient content: ${chapter.text.length} chars`,
                );
                return false;
            }
            return true;
        });

        // If all chapters were filtered out, the detection likely failed
        // Return empty to trigger default chapter fallback
        if (validChapters.length === 0 && chapters.length > 0) {
            this.logger.warn(
                `All ${chapters.length} detected chapters had insufficient content - detection may have failed`,
            );
            return [];
        }

        return validChapters;
    }

    private filterChapterMatches(
        text: string,
        matches: Array<{
            chapterNumber: number;
            title: string;
            position: number;
            matchLength: number;
            fullMatch: string;
        }>,
    ): Array<{
        chapterNumber: number;
        title: string;
        position: number;
        matchLength: number;
        fullMatch: string;
    }> {
        // Filter out matches that appear to be in table of contents, index, or appendix sections
        return matches.filter((match) => {
            // Get surrounding context (100 chars before and after)
            const contextStart = Math.max(0, match.position - 100);
            const contextEnd = Math.min(text.length, match.position + match.matchLength + 100);
            const context = text.slice(contextStart, contextEnd).toLowerCase();

            // Skip if in table of contents (look for TOC indicators nearby)
            if (this.isInTableOfContents(context, match.position - contextStart)) {
                this.logger.debug(
                    `Filtered out TOC entry: Chapter ${match.chapterNumber} at position ${match.position}`,
                );
                return false;
            }

            // Skip if this looks like an index entry (chapter followed by page number pattern)
            if (this.isIndexEntry(context, match.position - contextStart)) {
                this.logger.debug(
                    `Filtered out index entry: Chapter ${match.chapterNumber} at position ${match.position}`,
                );
                return false;
            }

            // Skip unreasonably high chapter numbers (likely from appendices or references)
            if (match.chapterNumber > 50) {
                this.logger.debug(
                    `Filtered out high chapter number: Chapter ${match.chapterNumber} at position ${match.position}`,
                );
                return false;
            }

            return true;
        });
    }

    private isInTableOfContents(context: string, matchPositionInContext: number): boolean {
        // Check for TOC indicators in the surrounding text
        // Include variations commonly found in books (including OCR'd text)
        const tocIndicators = [
            'table of contents',
            'list of chapters',
            '-----',
            'contents\n',  // "CONTENTS" at start of section
            '\ncontents',  // "CONTENTS" preceded by newline
        ];

        // Check if any TOC indicator is present
        for (const indicator of tocIndicators) {
            if (context.includes(indicator)) {
                return true;
            }
        }

        // Also check for standalone "CONTENTS" word (common in books)
        if (/\bcontents\b/i.test(context)) {
            return true;
        }

        // Get the line containing the chapter match
        const afterMatch = context.slice(matchPositionInContext);
        const lineEnd = afterMatch.indexOf('\n');
        const chapterLine = lineEnd > 0 ? afterMatch.slice(0, lineEnd) : afterMatch;

        // TOC entries typically have page numbers at the end
        // Pattern: "Chapter X  Title Text  123" or "Chapter X: Title ... 45"
        // Look for: title followed by spaces/dots and a 1-4 digit page number at line end
        if (/\s{2,}\d{1,4}\s*$/.test(chapterLine) || /\.{2,}\s*\d{1,4}\s*$/.test(chapterLine)) {
            return true;
        }

        // Also check if the "title" ends with what looks like a page number
        // e.g., "Cryptographic Tools 52" where 52 is a page number
        // Supports both "Chapter X" and "LAW X" formats
        const titleMatch = chapterLine.match(/(?:chapter|law)\s*\d+[:\.\s]+(.+)/i);
        if (titleMatch) {
            const title = titleMatch[1].trim();
            // If title ends with a standalone number (likely page number)
            if (/\s+\d{1,4}$/.test(title)) {
                return true;
            }
        }

        // Check for "page" appearing within a few lines after the chapter heading
        // This is a strong TOC indicator (e.g., "LAW1\npage\n1\n")
        const nextFewLines = afterMatch.slice(0, 100).toLowerCase();
        if (/\bpage\b/.test(nextFewLines)) {
            return true;
        }

        return false;
    }

    private isIndexEntry(context: string, matchPositionInContext: number): boolean {
        // Index entries typically have page numbers right after the chapter reference
        const afterMatch = context.slice(matchPositionInContext);

        // Pattern like "Chapter 1, 45" or "Chapter 1: 45, 67, 89" or "LAW 1, 45"
        if (/^(?:chapter|law)\s*\d+[,:\s]+\d+(?:\s*,\s*\d+)*\s*$/im.test(afterMatch.slice(0, 50))) {
            return true;
        }

        // Check if we're in an index section
        const beforeMatch = context.slice(0, matchPositionInContext);
        if (beforeMatch.includes('index') || beforeMatch.includes('references')) {
            return true;
        }

        return false;
    }

    private splitTextAtChapterPositions(
        text: string,
        chapterMatches: Array<{
            chapterNumber: number;
            title: string;
            position: number;
            matchLength: number;
            fullMatch: string;
        }>,
    ): ChapterData[] {
        const chapters: ChapterData[] = [];

        for (let i = 0; i < chapterMatches.length; i++) {
            const currentMatch = chapterMatches[i];
            const nextMatch = chapterMatches[i + 1];

            // Chapter text starts at the chapter heading
            const startPosition = currentMatch.position;

            // Chapter text ends at the next chapter heading, or end of document
            const endPosition = nextMatch ? nextMatch.position : text.length;

            const chapterText = text.slice(startPosition, endPosition).trim();

            chapters.push({
                chapterNumber: currentMatch.chapterNumber,
                title: currentMatch.title,
                text: chapterText,
            });

            this.logger.debug(
                `Chapter ${currentMatch.chapterNumber}: "${currentMatch.title}" - ${chapterText.length} chars`,
            );
        }

        return chapters;
    }

    private createDefaultChapter(fullText: string): ChapterData[] {
        return [
            {
                chapterNumber: 1,
                title: 'Full Book',
                text: fullText,
            },
        ];
    }

    private cleanText(text: string): string {
        // Decode HTML entities
        let cleaned = he.decode(text);

        // Remove excessive whitespace
        cleaned = cleaned.replace(/[ \t]+/g, ' ');
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

        // Remove common artifacts
        cleaned = cleaned.replace(/\f/g, ''); // Form feed characters

        return cleaned.trim();
    }

    /**
     * Detect if extracted text has poor OCR quality.
     * Poor quality indicators:
     * - Merged words (very long "words" without spaces)
     * - Low space-to-character ratio
     * - High ratio of abnormally long words
     *
     * @returns true if text quality is poor and re-OCR is recommended
     */
    private isPoorOcrQuality(text: string): boolean {
        if (!text || text.length < 1000) {
            return false; // Not enough text to analyze
        }

        // Sample middle portion of text (skip front matter)
        const sampleStart = Math.floor(text.length * 0.2);
        const sampleEnd = Math.min(sampleStart + 50000, text.length);
        const sample = text.slice(sampleStart, sampleEnd);

        // Check 1: Space ratio
        const spaceCount = (sample.match(/\s/g) || []).length;
        const spaceRatio = spaceCount / sample.length;

        if (spaceRatio < MIN_SPACE_RATIO) {
            this.logger.log(
                `Poor OCR detected: Low space ratio (${(spaceRatio * 100).toFixed(1)}% < ${MIN_SPACE_RATIO * 100}%)`,
            );
            return true;
        }

        // Check 2: Average word length and long word ratio
        const words = sample.split(/\s+/).filter((w) => w.length > 0);
        if (words.length === 0) {
            return false;
        }

        const totalWordLength = words.reduce((sum, w) => sum + w.length, 0);
        const avgWordLength = totalWordLength / words.length;

        if (avgWordLength > MAX_AVG_WORD_LENGTH) {
            this.logger.log(
                `Poor OCR detected: High avg word length (${avgWordLength.toFixed(1)} > ${MAX_AVG_WORD_LENGTH})`,
            );
            return true;
        }

        // Check 3: Ratio of very long words (>15 chars)
        const longWords = words.filter((w) => w.length > 15);
        const longWordRatio = longWords.length / words.length;

        if (longWordRatio > MAX_LONG_WORD_RATIO) {
            this.logger.log(
                `Poor OCR detected: High long-word ratio (${(longWordRatio * 100).toFixed(1)}% > ${MAX_LONG_WORD_RATIO * 100}%)`,
            );
            // Log some examples of long words for debugging
            const examples = longWords.slice(0, 5).map((w) => w.slice(0, 30));
            this.logger.debug(`Long word examples: ${examples.join(', ')}`);
            return true;
        }

        this.logger.debug(
            `OCR quality OK: space=${(spaceRatio * 100).toFixed(1)}%, avgWordLen=${avgWordLength.toFixed(1)}, longWordRatio=${(longWordRatio * 100).toFixed(1)}%`,
        );
        return false;
    }

    private stripHtml(html: string): string {
        // Simple HTML tag removal
        return html
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
    }
}
