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

        const chapters = this.detectChaptersInText(fullText);

        return {
            fullText,
            chapters: chapters.length > 0 ? chapters : this.createDefaultChapter(fullText),
            metadata,
            extractionMethod: 'text',
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
        // Patterns for chapter detection
        const chapterPatterns = [
            /^Chapter\s+(\d+)[:\s]+(.*)$/gim,
            /^CHAPTER\s+(\d+)[:\s]+(.*)$/gim,
            /^Part\s+(\d+)[:\s]+(.*)$/gim,
        ];

        const chapters: ChapterData[] = [];
        let matches: RegExpExecArray | null;

        for (const pattern of chapterPatterns) {
            const regex = new RegExp(pattern);
            while ((matches = regex.exec(text)) !== null) {
                chapters.push({
                    chapterNumber: parseInt(matches[1]),
                    title: matches[2]?.trim() || `Chapter ${matches[1]}`,
                    text: '', // Will be populated by splitting text
                });
            }
            if (chapters.length > 0) break;
        }

        // If chapters detected, split text between them
        if (chapters.length > 0) {
            return this.splitTextIntoChapters(text, chapters);
        }

        return [];
    }

    private splitTextIntoChapters(text: string, chapterMarkers: ChapterData[]): ChapterData[] {
        // Split the full text into chunks based on chapter markers
        const lines = text.split('\n');
        const chapters: ChapterData[] = [];

        // For now, if we detected chapter markers, split text evenly
        const chunkSize = Math.floor(lines.length / chapterMarkers.length);

        chapterMarkers.forEach((marker, idx) => {
            const start = idx * chunkSize;
            const end = idx === chapterMarkers.length - 1 ? lines.length : (idx + 1) * chunkSize;
            const chapterText = lines.slice(start, end).join('\n').trim();

            chapters.push({
                ...marker,
                text: chapterText,
            });
        });

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
