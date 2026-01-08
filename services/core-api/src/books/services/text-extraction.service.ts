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

        // Try TOC-based chapter extraction first (more accurate)
        let chapters = await this.extractChaptersFromToc(buffer, metadata.pageCount || 0);

        // Fall back to regex-based detection if no TOC or TOC extraction failed
        if (chapters.length === 0) {
            this.logger.log('No TOC found or TOC extraction failed. Using regex-based chapter detection.');
            chapters = this.detectChaptersInText(fullText);
        }

        return {
            fullText,
            chapters: chapters.length > 0 ? chapters : this.createDefaultChapter(fullText),
            metadata,
            extractionMethod: 'text',
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
        // Handle common formats: "Chapter X", "Chapter X: Title", "X. Title"
        const escapedTitle = chapterTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const patterns = [
            // Exact title match
            new RegExp(`(.*?)(?=\\b${escapedTitle}\\b)`, 'is'),
            // "Chapter N" or "CHAPTER N" format
            new RegExp(`(.*?)(?=\\bChapter\\s+\\d+\\b)`, 'i'),
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

            return {
                fullText,
                chapters: chapters.length > 0 ? chapters : this.createDefaultChapter(fullText),
                metadata: {
                    ...existingMetadata,
                    pageCount: numPages,
                },
                extractionMethod: 'ocr',
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
        const chapterPatterns = [
            /^(Chapter\s+(\d+))(?:[:\.\s]+(.*))?$/gim,
            /^(CHAPTER\s+(\d+))(?:[:\.\s]+(.*))?$/gim,
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
        // Real chapters should have at least 1000 characters of content
        const MIN_CHAPTER_CONTENT_LENGTH = 1000;
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
        const tocIndicators = ['table of contents', 'list of chapters', '-----'];

        // Check if any TOC indicator is present
        for (const indicator of tocIndicators) {
            if (context.includes(indicator)) {
                return true;
            }
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
        const titleMatch = chapterLine.match(/chapter\s+\d+[:\.\s]+(.+)/i);
        if (titleMatch) {
            const title = titleMatch[1].trim();
            // If title ends with a standalone number (likely page number)
            if (/\s+\d{1,4}$/.test(title)) {
                return true;
            }
        }

        return false;
    }

    private isIndexEntry(context: string, matchPositionInContext: number): boolean {
        // Index entries typically have page numbers right after the chapter reference
        const afterMatch = context.slice(matchPositionInContext);

        // Pattern like "Chapter 1, 45" or "Chapter 1: 45, 67, 89"
        if (/^chapter\s+\d+[,:\s]+\d+(?:\s*,\s*\d+)*\s*$/im.test(afterMatch.slice(0, 50))) {
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
