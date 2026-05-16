import { Injectable, Logger } from '@nestjs/common';
import * as he from 'he';
import Tesseract from 'tesseract.js';

export interface ExtractedContent {
    fullText: string;
    chapters: ChapterData[];
    metadata: {
        title?: string;
        author?: string;
        subject?: string;
        keywords?: string[];
        pageCount?: number;
        language?: string;
        creationDate?: Date;
        modificationDate?: Date;
    };
    extractionMethod?: 'text' | 'ocr';
    /**
     * Warnings about extraction quality or limitations.
     * Users should be notified about these issues.
     */
    extractionWarnings?: string[];
}

export enum ExtractionQuality {
    HIGH = 'high', // Embedded TOC/bookmarks used
    MEDIUM = 'medium', // Printed TOC parsed successfully
    LOW = 'low', // Regex-based detection only
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
    pageLabel?: string; // Display label (e.g., "i", "ii", "1", "A-1")
    chapterNumber?: number;
    level: number; // Nesting depth (0 = top level)
    /** Destination type from PDF (XYZ, Fit, FitH, etc.) */
    destType?: string;
    /** Y coordinate on page where chapter starts (for same-page splitting) */
    destY?: number;
    /** Whether this entry represents actual chapter content vs front/back matter */
    isChapter: boolean;
}

/** Page label configuration from PDF - reserved for future use */
interface _PageLabelRange {
    startPage: number; // 0-indexed physical page
    prefix?: string; // e.g., "A-" for "A-1", "A-2"
    style?: 'decimal' | 'roman-lower' | 'roman-upper' | 'alpha-lower' | 'alpha-upper';
    startNumber: number; // Starting number for this range
}

// Minimum characters per page to consider PDF as having extractable text
const MIN_CHARS_PER_PAGE = 100;

// Front matter patterns to identify non-chapter content
const FRONT_MATTER_PATTERNS = new Set([
    'cover',
    'front cover',
    'title page',
    'title',
    'copyright',
    'copyright page',
    'dedication',
    'dedication page',
    'acknowledgments',
    'acknowledgements',
    'preface',
    'foreword',
    'introduction',
    'prologue',
    'about the author',
    'about the authors',
    'contents',
    'table of contents',
    'notation',
    'symbols',
    'key to symbols',
    'list of symbols',
    'abbreviations',
    'list of abbreviations',
]);

// Back matter patterns
const BACK_MATTER_PATTERNS = new Set([
    'index',
    'bibliography',
    'selected bibliography',
    'references',
    'appendix',
    'appendices',
    'glossary',
    'notes',
    'endnotes',
    'afterword',
    'epilogue',
    'colophon',
    'about the author',
    'about the authors',
    'back cover',
]);

// Written-out number words → numeric value (supports 1-99, covers virtually all books)
const WORD_TO_NUMBER: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
    eighteen: 18, nineteen: 19, twenty: 20, 'twenty-one': 21, 'twenty-two': 22, 'twenty-three': 23,
    'twenty-four': 24, 'twenty-five': 25, 'twenty-six': 26, 'twenty-seven': 27, 'twenty-eight': 28,
    'twenty-nine': 29, thirty: 30, 'thirty-one': 31, 'thirty-two': 32, 'thirty-three': 33,
    'thirty-four': 34, 'thirty-five': 35, 'thirty-six': 36, 'thirty-seven': 37, 'thirty-eight': 38,
    'thirty-nine': 39, forty: 40, 'forty-one': 41, 'forty-two': 42, 'forty-three': 43,
    'forty-four': 44, 'forty-five': 45, 'forty-six': 46, 'forty-seven': 47, 'forty-eight': 48,
    'forty-nine': 49, fifty: 50, 'fifty-one': 51, 'fifty-two': 52, 'fifty-three': 53,
    'fifty-four': 54, 'fifty-five': 55, 'fifty-six': 56, 'fifty-seven': 57, 'fifty-eight': 58,
    'fifty-nine': 59, sixty: 60, 'sixty-one': 61, 'sixty-two': 62, 'sixty-three': 63,
    'sixty-four': 64, 'sixty-five': 65, 'sixty-six': 66, 'sixty-seven': 67, 'sixty-eight': 68,
    'sixty-nine': 69, seventy: 70, 'seventy-one': 71, 'seventy-two': 72, 'seventy-three': 73,
    'seventy-four': 74, 'seventy-five': 75, 'seventy-six': 76, 'seventy-seven': 77,
    'seventy-eight': 78, 'seventy-nine': 79, eighty: 80, 'eighty-one': 81, 'eighty-two': 82,
    'eighty-three': 83, 'eighty-four': 84, 'eighty-five': 85, 'eighty-six': 86, 'eighty-seven': 87,
    'eighty-eight': 88, 'eighty-nine': 89, ninety: 90, 'ninety-one': 91, 'ninety-two': 92,
    'ninety-three': 93, 'ninety-four': 94, 'ninety-five': 95, 'ninety-six': 96, 'ninety-seven': 97,
    'ninety-eight': 98, 'ninety-nine': 99,
};

/**
 * Parse a written-out number word to its numeric value.
 * Handles: "One" → 1, "Twenty-Five" → 25, "THIRTY-THREE" → 33
 * Returns undefined if not a recognized number word.
 */
function parseWordNumber(word: string): number | undefined {
    return WORD_TO_NUMBER[word.toLowerCase().trim()];
}

// Regex fragment matching any written-out number (case-insensitive)
// Compound numbers (e.g., "twenty-five") must come before simple ones so the regex is greedy
const WORD_NUMBER_PATTERN =
    '(?:twenty-one|twenty-two|twenty-three|twenty-four|twenty-five|twenty-six|twenty-seven|twenty-eight|twenty-nine|' +
    'thirty-one|thirty-two|thirty-three|thirty-four|thirty-five|thirty-six|thirty-seven|thirty-eight|thirty-nine|' +
    'forty-one|forty-two|forty-three|forty-four|forty-five|forty-six|forty-seven|forty-eight|forty-nine|' +
    'fifty-one|fifty-two|fifty-three|fifty-four|fifty-five|fifty-six|fifty-seven|fifty-eight|fifty-nine|' +
    'sixty-one|sixty-two|sixty-three|sixty-four|sixty-five|sixty-six|sixty-seven|sixty-eight|sixty-nine|' +
    'seventy-one|seventy-two|seventy-three|seventy-four|seventy-five|seventy-six|seventy-seven|seventy-eight|seventy-nine|' +
    'eighty-one|eighty-two|eighty-three|eighty-four|eighty-five|eighty-six|eighty-seven|eighty-eight|eighty-nine|' +
    'ninety-one|ninety-two|ninety-three|ninety-four|ninety-five|ninety-six|ninety-seven|ninety-eight|ninety-nine|' +
    'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|' +
    'eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)';

// Quality thresholds for OCR text detection
const MAX_AVG_WORD_LENGTH = 12; // Words longer than this suggest merged words
const MIN_SPACE_RATIO = 0.1; // At least 10% of characters should be spaces
const MAX_LONG_WORD_RATIO = 0.15; // Max 15% of words can be "long" (>15 chars)

@Injectable()
export class TextExtractionService {
    private readonly logger = new Logger(TextExtractionService.name);

    async extractFromPdf(buffer: Buffer): Promise<ExtractedContent> {
        // pdf-parse 1.x - CommonJS module with simple API
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);

        const metadata = this.extractEnhancedMetadata(data);

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
            chapters = this.detectChaptersInText(fullText, metadata.pageCount);

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
    private async extractChaptersFromToc(
        buffer: Buffer,
        totalPages: number,
    ): Promise<ChapterData[]> {
        try {
            const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
            // pdfjs-dist requires Uint8Array, not Node.js Buffer
            const uint8Array = new Uint8Array(buffer);
            // isEvalSupported:false + enableXfa:false neutralize embedded
            // PDF JavaScript and XFA forms that could run during parsing.
            const loadingTask = pdfjs.getDocument({
                data: uint8Array,
                isEvalSupported: false,
                enableXfa: false,
            });
            const pdfDoc = await loadingTask.promise;

            // Extract TOC/outline from PDF
            const outline = await pdfDoc.getOutline();

            if (!outline || outline.length === 0) {
                this.logger.debug('PDF has no outline/TOC');
                return [];
            }

            // Log raw outline structure for debugging
            this.logger.log(`Raw PDF outline has ${outline.length} top-level entries`);
            this.logOutlineStructure(outline, 0);

            // Extract page labels (Roman numerals, custom prefixes, etc.)
            const pageLabels = await this.extractPageLabels(pdfDoc);

            // Parse outline entries and get page numbers with coordinates
            const tocEntries = await this.parseTocEntries(pdfDoc, outline, pageLabels);

            if (tocEntries.length === 0) {
                this.logger.debug('Could not extract valid TOC entries');
                return [];
            }

            // Apply dynamic pattern detection to identify chapters
            // This detects patterns like "RULE 1", "RULE 2", etc. even if "RULE" isn't in our known list
            this.applyChapterPatternDetection(tocEntries);

            // Filter to only chapter entries for splitting
            const chapterEntries = tocEntries.filter(e => e.isChapter);
            this.logger.log(
                `Found ${tocEntries.length} TOC entries, ${chapterEntries.length} are chapters`,
            );

            // When no chapter pattern detected (e.g. novels with character-named chapters),
            // fall back to entries that aren't known front/back matter
            let entriesToSplit: TocEntry[];
            if (chapterEntries.length > 0) {
                entriesToSplit = chapterEntries;
            } else {
                const nonMatterEntries = tocEntries.filter(
                    e => !this.isFrontOrBackMatter(e.title),
                );
                this.logger.log(
                    `No chapter pattern found. Using ${nonMatterEntries.length} non-front/back-matter entries`,
                );
                // Assign sequential chapter numbers
                nonMatterEntries.forEach((entry, idx) => {
                    entry.chapterNumber = idx + 1;
                    entry.isChapter = true;
                });
                entriesToSplit = nonMatterEntries.length > 0 ? nonMatterEntries : tocEntries;
            }

            // Extract text page-by-page for accurate splitting
            const pageTexts = await this.extractTextByPage(pdfDoc);

            // Split content based on TOC page numbers
            const chapters = this.splitTextByToc(entriesToSplit, pageTexts, totalPages);

            this.logger.log(`Extracted ${chapters.length} chapters from TOC`);

            return chapters;
        } catch (error) {
            this.logger.warn(`TOC extraction failed: ${error.message}`);
            return [];
        }
    }

    /**
     * Log the raw outline structure for debugging.
     */
    private logOutlineStructure(outline: any[], depth: number): void {
        const indent = '  '.repeat(depth);
        for (const item of outline) {
            const hasChildren = item.items && item.items.length > 0;
            const childCount = hasChildren ? ` (${item.items.length} children)` : '';
            this.logger.log(`${indent}OUTLINE: "${item.title}"${childCount}`);
            if (hasChildren && depth < 2) {
                // Only log 2 levels deep to avoid spam
                this.logOutlineStructure(item.items, depth + 1);
            }
        }
    }

    /**
     * Dynamically detect chapter naming patterns in TOC entries.
     *
     * Instead of relying solely on hardcoded patterns like "Chapter", "LAW", "RULE",
     * this method analyzes the actual TOC structure to find sequential patterns.
     *
     * For example, if we see:
     * - "RULE 1: Stand up straight..."
     * - "RULE 2: Treat yourself..."
     * - "RULE 3: Make friends..."
     * - etc.
     *
     * We detect that "RULE" is the chapter prefix and mark all matching entries as chapters.
     * This works for ANY naming convention, not just predefined ones.
     */
    private applyChapterPatternDetection(entries: TocEntry[]): void {
        // Only look at level-0 entries (top-level TOC items)
        const level0Entries = entries.filter(e => e.level === 0);

        if (level0Entries.length < 3) {
            // Not enough entries to detect a pattern
            return;
        }

        // Extract prefix patterns from titles
        // Pattern: "PREFIX NUMBER" where PREFIX is one or more words, NUMBER is a digit
        // Examples: "RULE 1", "Chapter 1", "LAW 1", "Part 1", "HABIT 1", etc.
        const prefixPattern = /^([A-Za-z\u200C]+)\s*(\d+)/i; // \u200C is zero-width non-joiner (found in some PDFs)

        // Group entries by their prefix
        const prefixGroups = new Map<string, { entry: TocEntry; number: number }[]>();

        for (const entry of level0Entries) {
            const match = entry.title.match(prefixPattern);
            if (match) {
                const prefix = match[1].toUpperCase(); // Normalize to uppercase
                const num = parseInt(match[2]);

                if (!prefixGroups.has(prefix)) {
                    prefixGroups.set(prefix, []);
                }
                prefixGroups.get(prefix)!.push({ entry, number: num });
            }
        }

        // Find groups with sequential patterns (at least 3 entries with sequential or near-sequential numbers)
        for (const [prefix, items] of prefixGroups) {
            if (items.length < 3) {
                continue; // Need at least 3 to establish a pattern
            }

            // Sort by number
            items.sort((a, b) => a.number - b.number);

            // Check if numbers are sequential or near-sequential (allow small gaps)
            // For "12 Rules for Life", we'd have 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12
            const numbers = items.map(i => i.number);
            const minNum = numbers[0];
            const maxNum = numbers[numbers.length - 1];
            const expectedRange = maxNum - minNum + 1;

            // Allow up to 20% missing entries (e.g., 10 entries for range of 12 is OK)
            const coverageRatio = items.length / expectedRange;

            if (coverageRatio >= 0.8 && items.length >= 3) {
                // This looks like a valid chapter pattern!
                this.logger.log(
                    `Detected chapter pattern: "${prefix}" with ${items.length} sequential entries (${minNum}-${maxNum})`,
                );

                // Mark all matching entries as chapters
                for (const item of items) {
                    item.entry.isChapter = true;
                    item.entry.chapterNumber = item.number;
                }
            }
        }

        // Log summary
        const detectedChapters = entries.filter(e => e.isChapter).length;
        if (detectedChapters > 0) {
            this.logger.log(`Pattern detection: ${detectedChapters} entries marked as chapters`);
        }
    }

    /**
     * Parse PDF outline entries recursively to extract TOC with page numbers,
     * coordinates, and page labels for accurate chapter splitting.
     */
    private async parseTocEntries(
        pdfDoc: any,
        outline: any[],
        pageLabels: Map<number, string>,
        depth = 0,
    ): Promise<TocEntry[]> {
        const entries: TocEntry[] = [];
        let chapterCounter = 1;

        for (const item of outline) {
            try {
                const title = item.title?.trim() || '';

                if (title.length === 0) {
                    // Still process nested items
                    if (item.items && item.items.length > 0) {
                        const nestedEntries = await this.parseTocEntries(
                            pdfDoc,
                            item.items,
                            pageLabels,
                            depth + 1,
                        );
                        entries.push(...nestedEntries);
                    }
                    continue;
                }

                // Get destination (page reference and coordinates) for this outline item
                let pageNumber: number | null = null;
                let destType: string | undefined;
                let destY: number | undefined;

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

                        // dest[1] is the destination type (name like /XYZ, /Fit, /FitH, etc.)
                        // dest[2], dest[3], dest[4] are coordinates depending on type
                        if (dest[1]?.name) {
                            destType = dest[1].name;

                            // For XYZ destinations: [page, /XYZ, left, top, zoom]
                            // For FitH destinations: [page, /FitH, top]
                            if (destType === 'XYZ' && dest[3] !== null) {
                                destY = dest[3]; // Y coordinate (top)
                            } else if (destType === 'FitH' && dest[2] !== null) {
                                destY = dest[2]; // Y coordinate for FitH
                            }
                        }
                    }
                }

                if (pageNumber !== null && pageNumber >= 0) {
                    // Determine if this is actual chapter content
                    const isChapter = this.isChapterContent(title, depth);

                    // Log why entries are being skipped for debugging
                    if (!isChapter) {
                        this.logger.debug(
                            `TOC entry skipped (not chapter): "${title}" at level ${depth}`,
                        );
                    }

                    // Try to extract chapter number from title
                    // Supports: "Chapter 5", "LAW 3", "Chapter Twenty-Five", etc.
                    const chapterMatch = title.match(
                        /^(?:Chapter|LAW|Law|Rule|Principle|Lesson|Unit|Module|Step|Habit|Secret|Key|Commandment|Part|Section)?\s*(\d+)/i,
                    );
                    // Also try written-out numbers: "Chapter One", "Chapter Thirty-Five"
                    const wordNumberMatch = title.match(
                        new RegExp(`^(?:Chapter|Law|Rule|Principle|Lesson|Step|Habit)\\s+(${WORD_NUMBER_PATTERN})`, 'i'),
                    );
                    let extractedChapterNum: number | undefined;
                    if (isChapter) {
                        if (chapterMatch) {
                            extractedChapterNum = parseInt(chapterMatch[1]);
                        } else if (wordNumberMatch) {
                            extractedChapterNum = parseWordNumber(wordNumberMatch[1]);
                        } else {
                            extractedChapterNum = chapterCounter++;
                        }
                    }

                    // Get page label (e.g., "iv", "12", "A-3")
                    const pageLabel = pageLabels.get(pageNumber);

                    entries.push({
                        title,
                        pageNumber, // 0-indexed
                        pageLabel,
                        chapterNumber: extractedChapterNum,
                        level: depth,
                        destType,
                        destY,
                        isChapter,
                    });

                    this.logger.debug(
                        `TOC: "${title}" -> Page ${pageNumber + 1}${pageLabel ? ` (${pageLabel})` : ''}, ` +
                            `Level ${depth}, isChapter=${isChapter}${destY !== undefined ? `, Y=${destY}` : ''}`,
                    );
                }

                // Process nested items recursively and include them
                if (item.items && item.items.length > 0) {
                    const nestedEntries = await this.parseTocEntries(
                        pdfDoc,
                        item.items,
                        pageLabels,
                        depth + 1,
                    );
                    entries.push(...nestedEntries);
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
     * Extract enhanced metadata from PDF info dictionary.
     * Includes subject, keywords, dates in addition to basic title/author.
     */
    private extractEnhancedMetadata(data: any): ExtractedContent['metadata'] {
        const info = data.info || {};

        // Parse keywords (can be comma, semicolon, or space separated)
        let keywords: string[] | undefined;
        if (info.Keywords) {
            keywords = info.Keywords.split(/[,;]/)
                .map((k: string) => k.trim())
                .filter((k: string) => k.length > 0);
        }

        return {
            title: info.Title || undefined,
            author: info.Author || undefined,
            subject: info.Subject || undefined,
            keywords: keywords?.length ? keywords : undefined,
            pageCount: data.numpages,
            language: info.Language || undefined,
            creationDate: this.parsePdfDate(info.CreationDate),
            modificationDate: this.parsePdfDate(info.ModDate),
        };
    }

    /**
     * Parse PDF date format (D:YYYYMMDDHHmmSSOHH'mm')
     * Example: "D:20231215103045+05'30'" -> Date object
     */
    private parsePdfDate(dateStr?: string): Date | undefined {
        if (!dateStr) return undefined;

        try {
            // Remove "D:" prefix if present
            const cleaned = dateStr.replace(/^D:/, '');

            // Extract components: YYYYMMDDHHmmSS
            const year = parseInt(cleaned.slice(0, 4));
            const month = parseInt(cleaned.slice(4, 6)) - 1; // 0-indexed
            const day = parseInt(cleaned.slice(6, 8)) || 1;
            const hour = parseInt(cleaned.slice(8, 10)) || 0;
            const minute = parseInt(cleaned.slice(10, 12)) || 0;
            const second = parseInt(cleaned.slice(12, 14)) || 0;

            if (isNaN(year) || year < 1900 || year > 2100) {
                return undefined;
            }

            return new Date(year, month, day, hour, minute, second);
        } catch {
            this.logger.debug(`Failed to parse PDF date: ${dateStr}`);
            return undefined;
        }
    }

    /**
     * Extract page labels from PDF (handles Roman numerals, custom prefixes, etc.)
     * Returns a Map from 0-indexed page number to display label.
     */
    private async extractPageLabels(pdfDoc: any): Promise<Map<number, string>> {
        const pageLabels = new Map<number, string>();

        try {
            // PDF.js getPageLabels returns array of labels for each page
            const labels = await pdfDoc.getPageLabels();

            if (labels && Array.isArray(labels)) {
                for (let i = 0; i < labels.length; i++) {
                    if (labels[i]) {
                        pageLabels.set(i, labels[i]);
                    }
                }
                this.logger.debug(`Extracted ${pageLabels.size} page labels from PDF`);
            }
        } catch (error) {
            // Page labels are optional - many PDFs don't have them
            this.logger.debug(`No page labels in PDF: ${error.message}`);
        }

        return pageLabels;
    }

    /**
     * Convert a number to Roman numeral (for fallback when PDF lacks labels).
     */
    private toRomanNumeral(num: number): string {
        const romanNumerals: [number, string][] = [
            [1000, 'm'],
            [900, 'cm'],
            [500, 'd'],
            [400, 'cd'],
            [100, 'c'],
            [90, 'xc'],
            [50, 'l'],
            [40, 'xl'],
            [10, 'x'],
            [9, 'ix'],
            [5, 'v'],
            [4, 'iv'],
            [1, 'i'],
        ];

        let result = '';
        for (const [value, numeral] of romanNumerals) {
            while (num >= value) {
                result += numeral;
                num -= value;
            }
        }
        return result;
    }

    /**
     * Check if a title matches known front or back matter patterns.
     * Used to filter out non-chapter entries when no chapter pattern is detected.
     */
    private isFrontOrBackMatter(title: string): boolean {
        const titleLower = title.toLowerCase().trim();

        // Exact match
        if (FRONT_MATTER_PATTERNS.has(titleLower) || BACK_MATTER_PATTERNS.has(titleLower)) {
            return true;
        }

        // Contains match (but not if it contains "law" or "chapter")
        for (const pattern of FRONT_MATTER_PATTERNS) {
            if (titleLower.includes(pattern) && !titleLower.includes('law') && !titleLower.includes('chapter')) {
                return true;
            }
        }
        for (const pattern of BACK_MATTER_PATTERNS) {
            if (titleLower.includes(pattern) && !titleLower.includes('law') && !titleLower.includes('chapter')) {
                return true;
            }
        }

        // "Part One", "Part Two" etc. (section dividers)
        if (/^part\s+(one|two|three|four|five|six|seven|eight|nine|ten|\w+)\b/i.test(title)) {
            return true;
        }

        // Organizational headers
        if (/^(online\s+chapters|online\s+appendices|acronyms|credits|list\s+of)/i.test(title)) {
            return true;
        }

        return false;
    }

    /**
     * Determine if a TOC entry title represents actual chapter content
     * vs front matter (preface, TOC) or back matter (index, bibliography).
     */
    private isChapterContent(title: string, level: number): boolean {
        const titleLower = title.toLowerCase().trim();

        // Skip front and back matter - check exact match first
        if (FRONT_MATTER_PATTERNS.has(titleLower) || BACK_MATTER_PATTERNS.has(titleLower)) {
            return false;
        }

        // Also check if title contains any front/back matter pattern
        for (const pattern of FRONT_MATTER_PATTERNS) {
            if (
                titleLower.includes(pattern) &&
                !titleLower.includes('law') &&
                !titleLower.includes('chapter')
            ) {
                return false;
            }
        }
        for (const pattern of BACK_MATTER_PATTERNS) {
            if (
                titleLower.includes(pattern) &&
                !titleLower.includes('law') &&
                !titleLower.includes('chapter')
            ) {
                return false;
            }
        }

        // Exclude "Part One", "Part Two", etc. - these are section dividers, not chapters
        // Also exclude other organizational headers
        const partWordPattern = /^part\s+(one|two|three|four|five|six|seven|eight|nine|ten|\w+)\b/i;
        if (partWordPattern.test(title)) {
            return false;
        }

        // Exclude common organizational headers that aren't chapters
        const orgHeaderPattern =
            /^(online\s+chapters|online\s+appendices|acronyms|credits|list\s+of)/i;
        if (orgHeaderPattern.test(title)) {
            return false;
        }

        // Check for chapter indicators (at ANY nesting level)
        // Matches: "Chapter 1", "LAW 1", "Law1", "LESSON 5", "RULE 1", "PRINCIPLE 3", etc.
        // This covers common book structures: traditional chapters, laws (48 Laws of Power),
        // rules (12 Rules for Life), lessons, principles, steps, habits, etc.
        const chapterPattern =
            /^(chapter|law|rule|principle|lesson|unit|module|step|habit|secret|key|commandment)\s*\d+/i;
        if (chapterPattern.test(title)) {
            return true;
        }

        // "Part 1", "Part 2" etc. with numbers ARE chapters (not "Part One" with words)
        const partNumberPattern = /^part\s*\d+/i;
        if (partNumberPattern.test(title)) {
            return true;
        }

        // Check for numbered entries like "1. Title" or "1 Title" (top-level only)
        // This catches TOC entries without "Chapter/LAW" prefix
        // Only apply to top-level (level 0-1) to avoid matching subsections like "2.1 Title"
        // Pattern matches: "1." (not "1.1"), "1 " (number followed by space)
        const numberedPattern = /^(\d+\.(?!\d)|\d+\s)/; // "1." or "1 " but not "1.1"
        if (level <= 1 && numberedPattern.test(title)) {
            return true;
        }

        // Top-level entries with reasonable titles are likely chapters
        // But ONLY if they start with "Chapter" to avoid false positives
        // (Skip generic titles like "Part One Technical Issues")
        if (level <= 1 && title.length > 2 && title.length < 200) {
            // Only accept if it looks like a chapter title
            if (/^chapter\s/i.test(title)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Split text content based on TOC page numbers and coordinates.
     * Handles the edge case where multiple chapters start on the same page
     * using Y coordinates when available, falling back to title regex matching.
     */
    private splitTextByToc(
        tocEntries: TocEntry[],
        pageTexts: string[],
        totalPages: number,
    ): ChapterData[] {
        const chapters: ChapterData[] = [];

        // Sort entries by page number, then by Y coordinate (descending - PDF Y starts from bottom)
        // This ensures chapters on the same page are ordered top-to-bottom
        const sortedEntries = [...tocEntries].sort((a, b) => {
            if (a.pageNumber !== b.pageNumber) {
                return a.pageNumber - b.pageNumber;
            }
            // Same page: sort by Y coordinate descending (higher Y = higher on page)
            const aY = a.destY ?? Infinity;
            const bY = b.destY ?? Infinity;
            return bY - aY;
        });

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
                // Both chapters share the same page
                // Try coordinate-based splitting first, fall back to regex
                chapterText = this.splitSharedPageWithCoordinates(
                    chapterText,
                    current,
                    next,
                    pageTexts[startPage] || '',
                );
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

        // Filter out chapters below minimum content length (catches cover pages, maps, etc.)
        const MIN_TOC_CHAPTER_LENGTH = 500;
        const filtered = chapters.filter(ch => ch.text.length >= MIN_TOC_CHAPTER_LENGTH);
        if (filtered.length < chapters.length) {
            this.logger.log(
                `Filtered ${chapters.length - filtered.length} chapters below ${MIN_TOC_CHAPTER_LENGTH} chars minimum`,
            );
            // Renumber sequentially after filtering
            filtered.forEach((ch, idx) => {
                ch.chapterNumber = idx + 1;
            });
        }

        return filtered;
    }

    /**
     * Split a shared page between two chapters using coordinates when available.
     * Falls back to title-based regex splitting if coordinates aren't available.
     */
    private splitSharedPageWithCoordinates(
        pageText: string,
        current: TocEntry,
        next: TocEntry,
        rawPageText: string,
    ): string {
        // If both chapters have Y coordinates, we can estimate the split position
        if (current.destY !== undefined && next.destY !== undefined && current.destY > next.destY) {
            // Calculate approximate character position based on Y coordinate ratio
            // PDF Y coordinates: higher value = higher on page
            // Estimate: the ratio of Y positions roughly maps to text position
            const pageHeight = current.destY; // Use current's Y as approximate page top
            const splitRatio = (pageHeight - next.destY) / pageHeight;
            const estimatedSplitPos = Math.floor(rawPageText.length * splitRatio);

            // Search for next chapter's title near the estimated position
            const searchWindow = Math.min(500, rawPageText.length * 0.2);
            const searchStart = Math.max(0, estimatedSplitPos - searchWindow);
            const searchEnd = Math.min(rawPageText.length, estimatedSplitPos + searchWindow);
            const searchText = rawPageText.slice(searchStart, searchEnd);

            const splitResult = this.findChapterSplitPoint(searchText, next.title);
            if (splitResult.found) {
                const absoluteSplitPos =
                    searchStart +
                    (searchText.length - splitResult.afterHeading.length - next.title.length);
                this.logger.debug(
                    `Coordinate-based split for "${next.title}": Y=${next.destY}, ` +
                        `estimated pos=${estimatedSplitPos}, actual=${absoluteSplitPos}`,
                );
                return rawPageText.slice(0, absoluteSplitPos).trim();
            }
        }

        // Fall back to regex-based title matching
        return this.splitSharedPage(pageText, current.title, next.title);
    }

    /**
     * Split text when two chapters share the same starting page.
     * Uses regex to find the next chapter's title and split before it.
     */
    private splitSharedPage(pageText: string, _currentTitle: string, nextTitle: string): string {
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
        // Handle common formats: "Chapter X", "LAW X", "RULE X", "PRINCIPLE X", etc.
        const escapedTitle = chapterTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const patterns = [
            // Exact title match
            new RegExp(`(.*?)(?=\\b${escapedTitle}\\b)`, 'is'),
            // "Chapter N" or "CHAPTER N" format
            new RegExp(`(.*?)(?=\\bChapter\\s+\\d+\\b)`, 'i'),
            // "LAW N" or "Law N" format (with or without space due to OCR)
            new RegExp(`(.*?)(?=\\bLAW\\s*\\d+\\b)`, 'i'),
            // "RULE N" format (12 Rules for Life, etc.)
            new RegExp(`(.*?)(?=\\bRULE\\s*\\d+\\b)`, 'i'),
            // "PRINCIPLE N" format (Principles by Ray Dalio, etc.)
            new RegExp(`(.*?)(?=\\bPRINCIPLE\\s*\\d+\\b)`, 'i'),
            // "STEP N" format (how-to books)
            new RegExp(`(.*?)(?=\\bSTEP\\s*\\d+\\b)`, 'i'),
            // "LESSON N" format
            new RegExp(`(.*?)(?=\\bLESSON\\s*\\d+\\b)`, 'i'),
            // "HABIT N" format (7 Habits, etc.)
            new RegExp(`(.*?)(?=\\bHABIT\\s*\\d+\\b)`, 'i'),
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
        const chapters = this.splitTextByPrintedToc(
            contentText,
            tocEntries,
            charsPerPage,
            contentStartPage,
        );

        // Filter out chapters with insufficient content
        const MIN_CHAPTER_LENGTH = 1000;
        const validChapters = chapters.filter(ch => ch.text.length >= MIN_CHAPTER_LENGTH);

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

        // Extract a reasonable section after "contents" (enough for ~50 chapter entries)
        const tocStart = tocMatch.index!;
        const tocSection = text.slice(tocStart, tocStart + 30000);

        // Patterns for TOC entries with page numbers
        // Format: "Chapter X Title ... PageNum", "LAW X Title PageNum", "RULE X Title PageNum", etc.
        // Supports: Chapter, Law, Rule, Principle, Lesson, Step, Habit
        const patterns = [
            // "Chapter 1 Title 23" or "Chapter 1: Title 23" or "Chapter 1 Title ... 23"
            /^(Chapter\s+(\d+))[\s:.]+([^\d\n]+?)\s+(\d{1,4})\s*$/gim,
            // "CHAPTER 1 TITLE 23"
            /^(CHAPTER\s+(\d+))[\s:.]+([^\d\n]+?)\s+(\d{1,4})\s*$/gim,
            // "LAW 1 Title 23" or "LAW1 Title 23" or "LAW1Title 23" (OCR may merge)
            // Title can contain digits (e.g., "LAW 48 ASSUME FORMLESSNESS 419")
            /^(LAW\s*(\d+))[\s:.]*(.*?)\s+(\d{1,4})\s*$/gim,
            // "RULE 1 Title 23" or "RULE1 Title 23" (12 Rules for Life, etc.)
            /^(RULE\s*(\d+))[\s:.]*(.*?)\s+(\d{1,4})\s*$/gim,
            // "PRINCIPLE 1 Title 23" (Principles by Ray Dalio, etc.)
            /^(PRINCIPLE\s*(\d+))[\s:.]*(.*?)\s+(\d{1,4})\s*$/gim,
            // "STEP 1 Title 23" (how-to books)
            /^(STEP\s*(\d+))[\s:.]*(.*?)\s+(\d{1,4})\s*$/gim,
            // "LESSON 1 Title 23"
            /^(LESSON\s*(\d+))[\s:.]*(.*?)\s+(\d{1,4})\s*$/gim,
            // "HABIT 1 Title 23" (7 Habits, etc.)
            /^(HABIT\s*(\d+))[\s:.]*(.*?)\s+(\d{1,4})\s*$/gim,
            // "1. Title 23" (only match if number is <= 100 to avoid page number confusion)
            /^(\d{1,2})\.[\s]+([A-Z][^\n]+?)\s+(\d{1,4})\s*$/gm,
        ];

        // Written-out TOC patterns: "Chapter One ... 23", "Chapter Twenty-Five: Title 45"
        const wordTocPatterns = [
            new RegExp(`^(Chapter\\s+(${WORD_NUMBER_PATTERN}))(?:[\\s:.]+([^\\d\\n]+?))?\\s+(\\d{1,4})\\s*$`, 'gim'),
            new RegExp(`^(CHAPTER\\s+(${WORD_NUMBER_PATTERN}))(?:[\\s:.]+([^\\d\\n]+?))?\\s+(\\d{1,4})\\s*$`, 'gim'),
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
                title = title
                    .replace(/\.{2,}\s*$/, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                // Skip if title looks like a section number (e.g., "1.1 Introduction")
                if (/^\d+\.\d+/.test(title)) {
                    continue;
                }

                // Skip duplicates
                if (entries.some(e => e.chapterNumber === chapterNum)) {
                    continue;
                }

                // Skip unreasonable chapter numbers (likely misparsed page numbers)
                if (chapterNum > 100) {
                    this.logger.debug(`Skipping unreasonable chapter number: ${chapterNum}`);
                    continue;
                }

                // Validate page number is reasonable (1-9999)
                if (pageNum >= 1 && pageNum <= 9999 && title.length > 0) {
                    entries.push({
                        title: title,
                        pageNumber: pageNum,
                        chapterNumber: chapterNum,
                        level: 0, // Printed TOC entries are top-level
                        isChapter: true, // Printed TOC parsing only captures chapter-level entries
                    });
                }
            }

            // If we found entries with this pattern, don't try other patterns
            if (entries.length >= 3) {
                break;
            }
        }

        // If no numeric TOC entries found, try written-out number patterns
        if (entries.length < 3) {
            for (const pattern of wordTocPatterns) {
                let match: RegExpExecArray | null;
                const regex = new RegExp(pattern);

                while ((match = regex.exec(tocSection)) !== null) {
                    // group 2 = word number, group 3 = title (optional), group 4 = page
                    const chapterNum = parseWordNumber(match[2]);
                    if (chapterNum === undefined) continue;

                    let title = (match[3] || '').trim();
                    const pageNum = parseInt(match[4]);

                    title = title
                        .replace(/\.{2,}\s*$/, '')
                        .replace(/\s+/g, ' ')
                        .trim();

                    if (entries.some(e => e.chapterNumber === chapterNum)) continue;
                    if (chapterNum > 100) continue;

                    if (pageNum >= 1 && pageNum <= 9999) {
                        entries.push({
                            title: title || `Chapter ${chapterNum}`,
                            pageNumber: pageNum,
                            chapterNumber: chapterNum,
                            level: 0,
                            isChapter: true,
                        });
                    }
                }

                if (entries.length >= 3) break;
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
            const refinedStart = this.refineChapterStart(
                contentText,
                current,
                estimatedStart,
                charsPerPage,
            );
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
     *
     * IMPORTANT: Pattern order matters! More specific chapter heading patterns
     * must come before section number patterns to avoid matching "1.1" instead
     * of "CHAPTER 1".
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

        // Patterns to find the chapter heading - ORDER MATTERS!
        // More specific patterns first, section numbers LAST
        // Supports: Chapter, Law, Rule, Principle, Lesson, Step, Habit
        const patterns = [
            // "CHAPTER X / TITLE" format (common in textbooks)
            new RegExp(`CHAPTER\\s+${chapterNum}\\s*/\\s*`, 'i'),
            // "Chapter X" or "CHAPTER X" followed by title
            new RegExp(`Chapter\\s+${chapterNum}\\b[\\s:/.]*${escapedTitle.slice(0, 15)}`, 'i'),
            // Just "CHAPTER X" (uppercase) - textbook style
            new RegExp(`CHAPTER\\s+${chapterNum}\\b`, 'm'),
            // Just "Chapter X" at start of line (title case)
            new RegExp(`^Chapter\\s+${chapterNum}\\b`, 'im'),
            // LAW format
            new RegExp(`^LAW\\s*${chapterNum}\\b`, 'im'),
            // RULE format (12 Rules for Life, etc.)
            new RegExp(`^RULE\\s*${chapterNum}\\b`, 'im'),
            // PRINCIPLE format (Principles by Ray Dalio, etc.)
            new RegExp(`^PRINCIPLE\\s*${chapterNum}\\b`, 'im'),
            // STEP format (how-to books)
            new RegExp(`^STEP\\s*${chapterNum}\\b`, 'im'),
            // LESSON format
            new RegExp(`^LESSON\\s*${chapterNum}\\b`, 'im'),
            // HABIT format (7 Habits, etc.)
            new RegExp(`^HABIT\\s*${chapterNum}\\b`, 'im'),
            // Title alone at start of line (must be ALL CAPS or Title Case, not lowercase)
            new RegExp(`^${escapedTitle.slice(0, 30).toUpperCase()}`, 'm'),
            // DO NOT add section number pattern (e.g., "1.1") as it matches mid-chapter content
        ];

        for (const pattern of patterns) {
            const match = searchText.match(pattern);
            if (match && match.index !== undefined) {
                this.logger.debug(
                    `Found chapter ${chapterNum} heading at offset ${searchStart + match.index} using pattern: ${pattern.source.slice(0, 50)}`,
                );
                return searchStart + match.index;
            }
        }

        // No heading found, return estimated position
        this.logger.debug(
            `Could not find chapter ${chapterNum} heading, using estimated position ${estimatedPos}`,
        );
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

            // Load PDF document (pdfjs-dist requires Uint8Array, not Node.js Buffer)
            const uint8Array = new Uint8Array(buffer);
            // Disable PDF JavaScript + XFA forms to prevent execution of
            // embedded code during render.
            const loadingTask = pdfjs.getDocument({
                data: uint8Array,
                isEvalSupported: false,
                enableXfa: false,
            });
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
            const chapters = this.detectChaptersInText(fullText, numPages);

            // OCR extraction has inherent quality limitations
            const warnings: string[] = [
                'This PDF was processed using OCR (optical character recognition). ' +
                    'Text accuracy may vary, especially for complex layouts, images, or handwritten content.',
            ];

            const finalChapters =
                chapters.length > 0 ? chapters : this.createDefaultChapter(fullText);

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

    /**
     * Normalize a value from EPUB metadata into a string.
     *
     * @gxl/epub-parser uses xml2js, which represents XML elements with
     * attributes as { _: <text>, $: <attrs> }. Plain elements come through
     * as strings, repeated elements as arrays. Without unwrapping, downstream
     * stringification produces literal "[object Object]" titles.
     */
    private coerceEpubMetadata(value: unknown): string | undefined {
        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed || undefined;
        }
        if (Array.isArray(value) && value.length > 0) {
            return this.coerceEpubMetadata(value[0]);
        }
        if (value && typeof value === 'object' && '_' in value) {
            return this.coerceEpubMetadata((value as { _: unknown })._);
        }
        return undefined;
    }

    async extractFromEpub(buffer: Buffer): Promise<ExtractedContent> {
        // Dynamic import for @gxl/epub-parser (supports buffer input)
        const { parseEpub } = await import('@gxl/epub-parser');

        // Parse the epub buffer
        const epub = await parseEpub(buffer, { type: 'buffer' });

        const metadata = {
            title: this.coerceEpubMetadata(epub.info?.title),
            author: this.coerceEpubMetadata(epub.info?.author),
        };

        // Build TOC lookup: sectionId → chapter name (e.g., "Bran I", "Catelyn I")
        const tocNames = new Map<string, string>();
        if (epub.structure && Array.isArray(epub.structure)) {
            const flattenToc = (nodes: any[]) => {
                for (const node of nodes) {
                    if (node.sectionId && node.name) {
                        tocNames.set(node.sectionId, node.name.trim());
                    }
                    if (node.children) flattenToc(node.children);
                }
            };
            flattenToc(epub.structure);
        }

        const chapters: ChapterData[] = [];
        let fullText = '';

        if (epub.sections && Array.isArray(epub.sections)) {
            for (let i = 0; i < epub.sections.length; i++) {
                const section = epub.sections[i] as { id?: string; htmlString?: string };
                const htmlContent = section.htmlString || '';
                const text = this.cleanText(this.stripHtml(htmlContent));

                // Skip near-empty sections (title page, copyright, maps, etc.)
                if (text.trim().length < 1000) continue;

                // Title extraction: TOC name > HTML heading > meaningful section ID > fallback
                const sectionId = section.id || '';
                let title =
                    tocNames.get(sectionId) ||
                    this.extractTitleFromHtml(htmlContent) ||
                    (sectionId && !/^html\d+$/i.test(sectionId) ? sectionId : null) ||
                    `Chapter ${chapters.length + 1}`;

                // Skip non-content sections (table of contents, copyright, dedication, etc.)
                // Also catches abbreviated EPUB spine IDs like "cop", "itr", "fm2", "ded", "toc"
                const lowerTitle = title.toLowerCase();
                if (/^(contents?|table of contents|copyright|cop|dedication|ded|acknowledgements?|ack|about the author|also by|books by|title page|itr|toc|fm\d*|bm\d*|frontmatter|backmatter|half-?title|ht|epigraph|epi)$/i.test(lowerTitle)) {
                    continue;
                }

                chapters.push({
                    chapterNumber: chapters.length + 1,
                    title,
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

    /**
     * Lightweight metadata-only extraction.
     * Reads the PDF info dict or EPUB metadata without full text/chapter extraction.
     * Used by MetadataProbeService to quickly check if re-extraction would improve data.
     */
    async extractMetadataOnly(
        buffer: Buffer,
        sourceType: 'PDF' | 'EPUB',
    ): Promise<ExtractedContent['metadata']> {
        if (sourceType === 'PDF') {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const pdfParse = require('pdf-parse');
            const data = await pdfParse(buffer);
            return this.extractEnhancedMetadata(data);
        } else {
            const { parseEpub } = await import('@gxl/epub-parser');
            const epub = await parseEpub(buffer, { type: 'buffer' });
            return {
                title: this.coerceEpubMetadata(epub.info?.title),
                author: this.coerceEpubMetadata(epub.info?.author),
            };
        }
    }

    private detectChaptersInText(text: string, pageCount?: number): ChapterData[] {
        // Patterns for chapter detection - match at start of line
        // Captures: full match, chapter number, optional title
        // Supports: "Chapter X", "CHAPTER X", "LAW X", "RULE X", "PRINCIPLE X", etc.
        // Covers common book structures: traditional chapters, laws, rules, principles, lessons, steps, habits
        const chapterPatterns = [
            /^(Chapter\s+(\d+))(?:[:\s.]+(.*))?$/gim,
            /^(CHAPTER\s+(\d+))(?:[:\s.]+(.*))?$/gim,
            /^(LAW\s*(\d+))[:\s.]*(.*)$/gim, // "LAW 1", "LAW1", or "LAW1TITLE" (OCR often removes spaces)
            /^(Law\s*(\d+))[:\s.]*(.*)$/gim,
            /^(RULE\s*(\d+))[:\s.]*(.*)$/gim, // "RULE 1", "RULE1" (12 Rules for Life, etc.)
            /^(Rule\s*(\d+))[:\s.]*(.*)$/gim,
            /^(PRINCIPLE\s*(\d+))[:\s.]*(.*)$/gim, // "PRINCIPLE 1" (Principles by Ray Dalio, etc.)
            /^(Principle\s*(\d+))[:\s.]*(.*)$/gim,
            /^(STEP\s*(\d+))[:\s.]*(.*)$/gim, // "STEP 1" (how-to books)
            /^(Step\s*(\d+))[:\s.]*(.*)$/gim,
            /^(LESSON\s*(\d+))[:\s.]*(.*)$/gim, // "LESSON 1"
            /^(Lesson\s*(\d+))[:\s.]*(.*)$/gim,
            /^(HABIT\s*(\d+))[:\s.]*(.*)$/gim, // "HABIT 1" (7 Habits, etc.)
            /^(Habit\s*(\d+))[:\s.]*(.*)$/gim,
        ];

        // Written-out number patterns: "Chapter One", "Chapter Twenty-Five", etc.
        const wordNumberPatterns = [
            new RegExp(`^(Chapter\\s+(${WORD_NUMBER_PATTERN}))(?:[:\\s.]+(.*))?$`, 'gim'),
            new RegExp(`^(CHAPTER\\s+(${WORD_NUMBER_PATTERN}))(?:[:\\s.]+(.*))?$`, 'gim'),
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

        // Try numeric patterns first
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

                // Skip if this looks like a mid-sentence reference rather than a chapter heading.
                // Chapter headings typically have capitalized titles like "Overview", "User Authentication"
                // References look like "Chapter 1 listed a number..." or "Chapter 2 is your intuitive prediction..."
                // Note: short words like "is", "in", "it", "as" are the most common mid-sentence starters,
                // so we check them explicitly — no length filter.
                const firstWord = title.split(/\s+/)[0];
                if (firstWord) {
                    const looksLikeSentence =
                        /^[a-z]/.test(firstWord) || // starts with lowercase
                        /^(the|a|an|is|in|it|as|at|by|of|on|to|or|so|if|be|we|he|she|you|they|i|are|was|were|has|have|had|will|would|could|should|can|may|might|must|listed|includes|describes|explains|provides|contains|discusses|presents|covers|shows|demonstrates|illustrates|introduces|examines|explores|considers|addresses|deals|focuses|offers|gives|takes|makes|uses|also|then|this|that|these|those|its|such|each|both|all|any|some|most|many|few|several|various|other|another|more|less|further|additional|following|preceding|above|below|previous|next|first|second|third|last|final|later|earlier|recently|currently|already|still|yet|now|here|there|where|when|how|why|what|which|who|whom|whose)$/i.test(
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

        // If no numeric matches, try written-out number patterns ("Chapter One", "Chapter Twenty-Five")
        if (chapterMatches.length === 0) {
            for (const pattern of wordNumberPatterns) {
                const regex = new RegExp(pattern);
                while ((matches = regex.exec(text)) !== null) {
                    const chapterNum = parseWordNumber(matches[2]);
                    if (chapterNum === undefined) continue;

                    const title = matches[3]?.trim().replace(/\s+\d{1,4}\s*$/, '').trim()
                        || `Chapter ${chapterNum}`;

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
        const uniqueMatches = filteredMatches.filter(match => {
            if (seenChapters.has(match.chapterNumber)) {
                return false;
            }
            seenChapters.add(match.chapterNumber);
            return true;
        });

        // Split text at actual chapter positions
        const chapters = this.splitTextAtChapterPositions(text, uniqueMatches, pageCount);

        // Filter out chapters with insufficient content (likely TOC entries that slipped through)
        // Real chapters should have at least 2500 characters of content
        // (TOC entries with brief summaries are typically 100-500 chars between headings)
        const MIN_CHAPTER_CONTENT_LENGTH = 2500;
        const validChapters = chapters.filter(chapter => {
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

        // Sanity check: if we only detected 1 chapter and it swallows >70% of the book text,
        // this is almost certainly a false positive (a stray "Chapter N" reference in body text
        // caused us to grab everything from that point onward). Reject it — caller will fall
        // back to a single "Full Book" chapter with the appropriate warning.
        // Real books with real chapter markers always produce multiple detected chapters.
        if (validChapters.length === 1 && text.length > 50000) {
            const coverage = validChapters[0].text.length / text.length;
            if (coverage > 0.7) {
                this.logger.warn(
                    `Single-chapter detection covers ${(coverage * 100).toFixed(0)}% of book text ` +
                        `(${validChapters[0].text.length}/${text.length} chars) — rejecting as false positive`,
                );
                return [];
            }
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
        return matches.filter(match => {
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
            'contents\n', // "CONTENTS" at start of section
            '\ncontents', // "CONTENTS" preceded by newline
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
        // Supports: Chapter, Law, Rule, Principle, Lesson, Step, Habit
        const titleMatch = chapterLine.match(
            /(?:chapter|law|rule|principle|lesson|step|habit)\s*\d+[:\s.]+(.+)/i,
        );
        if (titleMatch) {
            const title = titleMatch[1].trim();
            // If title ends with a standalone number (likely page number)
            if (/\s+\d{1,4}$/.test(title)) {
                return true;
            }
        }

        // Check for "page" appearing as a standalone word on its own line (TOC format)
        // e.g., "LAW1\npage\n1\n" - but NOT "turn the page" or "page of history"
        const nextFewLines = afterMatch.slice(0, 50);
        if (/^\s*page\s*$/im.test(nextFewLines)) {
            return true;
        }

        return false;
    }

    private isIndexEntry(context: string, matchPositionInContext: number): boolean {
        // Index entries typically have page numbers right after the chapter reference
        const afterMatch = context.slice(matchPositionInContext);

        // Pattern like "Chapter 1, 45" or "Chapter 1: 45, 67, 89" or "LAW 1, 45" or "RULE 1, 45"
        // Supports: Chapter, Law, Rule, Principle, Lesson, Step, Habit
        if (
            /^(?:chapter|law|rule|principle|lesson|step|habit)\s*\d+[,:\s]+\d+(?:\s*,\s*\d+)*\s*$/im.test(
                afterMatch.slice(0, 50),
            )
        ) {
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
        pageCount?: number,
    ): ChapterData[] {
        const chapters: ChapterData[] = [];

        // Estimate characters per page for startPage/endPage calculation
        const charsPerPage = pageCount && pageCount > 0 ? text.length / pageCount : 0;

        for (let i = 0; i < chapterMatches.length; i++) {
            const currentMatch = chapterMatches[i];
            const nextMatch = chapterMatches[i + 1];

            // Chapter text starts at the chapter heading
            const startPosition = currentMatch.position;

            // Chapter text ends at the next chapter heading, or end of document
            const endPosition = nextMatch ? nextMatch.position : text.length;

            const chapterText = text.slice(startPosition, endPosition).trim();

            // Estimate page numbers from character positions
            const startPage =
                charsPerPage > 0 ? Math.floor(startPosition / charsPerPage) + 1 : undefined;
            const endPage = charsPerPage > 0 ? Math.floor(endPosition / charsPerPage) : undefined;

            chapters.push({
                chapterNumber: currentMatch.chapterNumber,
                title: currentMatch.title,
                text: chapterText,
                startPage,
                endPage,
            });

            this.logger.debug(
                `Chapter ${currentMatch.chapterNumber}: "${currentMatch.title}" - ${chapterText.length} chars (pages ${startPage || '?'}-${endPage || '?'})`,
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
        if (!text || typeof text !== 'string') return '';

        // Decode HTML entities
        let cleaned = he.decode(text);
        if (typeof cleaned !== 'string') cleaned = String(cleaned ?? '');

        // Remove null bytes (PostgreSQL rejects 0x00 in UTF8 text columns)
        cleaned = cleaned.replace(/\0/g, '');

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
        const words = sample.split(/\s+/).filter(w => w.length > 0);
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
        const longWords = words.filter(w => w.length > 15);
        const longWordRatio = longWords.length / words.length;

        if (longWordRatio > MAX_LONG_WORD_RATIO) {
            this.logger.log(
                `Poor OCR detected: High long-word ratio (${(longWordRatio * 100).toFixed(1)}% > ${MAX_LONG_WORD_RATIO * 100}%)`,
            );
            // Log some examples of long words for debugging
            const examples = longWords.slice(0, 5).map(w => w.slice(0, 30));
            this.logger.debug(`Long word examples: ${examples.join(', ')}`);
            return true;
        }

        this.logger.debug(
            `OCR quality OK: space=${(spaceRatio * 100).toFixed(1)}%, avgWordLen=${avgWordLength.toFixed(1)}, longWordRatio=${(longWordRatio * 100).toFixed(1)}%`,
        );
        return false;
    }

    private extractTitleFromHtml(html: string): string | null {
        // Match first h1, h2, or h3 (case-insensitive, handles attributes, spans lines)
        const match = html.match(/<h[123][^>]*>([\s\S]*?)<\/h[123]>/i);
        if (!match) return null;

        // Strip nested tags, decode entities, collapse whitespace
        const raw = match[1].replace(/<[^>]*>/g, '').trim();
        const decoded = he.decode(raw).replace(/\s+/g, ' ').trim();
        return decoded.length > 0 ? decoded : null;
    }

    private stripHtml(html: string): string {
        if (!html || typeof html !== 'string') return '';
        // Simple HTML tag removal
        return html
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
    }
}
