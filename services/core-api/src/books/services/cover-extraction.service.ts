import { Injectable, Logger } from '@nestjs/common';

export interface CoverExtractionResult {
    coverImageUrl: string | null;
    coverImageKey: string | null;
    source: 'google_books' | 'pdf_extraction' | 'epub_extraction' | null;
}

@Injectable()
export class CoverExtractionService {
    private readonly logger = new Logger(CoverExtractionService.name);

    /**
     * Extract or fetch cover image for a book.
     * Strategy:
     * 1. Try Google Books API first (higher quality covers)
     * 2. Fall back to PDF/EPUB extraction
     */
    async extractCover(
        fileBuffer: Buffer,
        sourceType: 'PDF' | 'EPUB',
        metadata: {
            title?: string;
            author?: string;
            isbn?: string;
        },
        storageCallback: (imageBuffer: Buffer, key: string) => Promise<string>,
        storageKey: string,
    ): Promise<CoverExtractionResult> {
        // 1. Try Google Books API first
        const googleCover = await this.fetchGoogleBooksCover(metadata);
        if (googleCover) {
            this.logger.log(`Found cover from Google Books for "${metadata.title}"`);
            return {
                coverImageUrl: googleCover,
                coverImageKey: null, // External URL, no local storage
                source: 'google_books',
            };
        }

        // 2. Fall back to file extraction
        this.logger.log(`No Google Books cover found, extracting from ${sourceType}...`);

        try {
            let imageBuffer: Buffer | null = null;

            if (sourceType === 'PDF') {
                imageBuffer = await this.extractPdfCover(fileBuffer);
            } else if (sourceType === 'EPUB') {
                imageBuffer = await this.extractEpubCover(fileBuffer);
            }

            if (imageBuffer && imageBuffer.length > 0) {
                // Upload to storage
                const coverKey = `${storageKey}/cover.jpg`;
                await storageCallback(imageBuffer, coverKey);

                // For local storage, construct the URL path
                // The actual URL depends on how the API serves files
                const coverUrl = `/api/storage/${coverKey}`;

                this.logger.log(`Extracted cover from ${sourceType}: ${coverKey}`);
                return {
                    coverImageUrl: coverUrl,
                    coverImageKey: coverKey,
                    source: sourceType === 'PDF' ? 'pdf_extraction' : 'epub_extraction',
                };
            }
        } catch (error) {
            this.logger.warn(`Failed to extract cover from ${sourceType}: ${error.message}`);
        }

        this.logger.log('No cover image could be extracted');
        return {
            coverImageUrl: null,
            coverImageKey: null,
            source: null,
        };
    }

    /**
     * Fetch cover image URL from Google Books API.
     * Free API, no key required for basic queries.
     */
    private async fetchGoogleBooksCover(metadata: {
        title?: string;
        author?: string;
        isbn?: string;
    }): Promise<string | null> {
        try {
            let query = '';

            // Prefer ISBN search (most accurate)
            if (metadata.isbn) {
                query = `isbn:${metadata.isbn}`;
            } else if (metadata.title) {
                // Search by title and author
                query = `intitle:${encodeURIComponent(metadata.title)}`;
                if (metadata.author) {
                    query += `+inauthor:${encodeURIComponent(metadata.author)}`;
                }
            } else {
                return null;
            }

            const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1`;
            this.logger.debug(`Google Books API query: ${url}`);

            const response = await fetch(url);
            if (!response.ok) {
                this.logger.warn(`Google Books API error: ${response.status}`);
                return null;
            }

            const data = await response.json();

            if (data.totalItems === 0 || !data.items || data.items.length === 0) {
                this.logger.debug('No results from Google Books API');
                return null;
            }

            const volumeInfo = data.items[0].volumeInfo;
            const imageLinks = volumeInfo?.imageLinks;

            if (!imageLinks) {
                this.logger.debug('No image links in Google Books result');
                return null;
            }

            // Prefer larger images: extraLarge > large > medium > small > thumbnail
            const coverUrl =
                imageLinks.extraLarge ||
                imageLinks.large ||
                imageLinks.medium ||
                imageLinks.small ||
                imageLinks.thumbnail;

            if (coverUrl) {
                // Google Books URLs use HTTP, convert to HTTPS
                // Also remove edge=curl parameter which adds a page curl effect
                const cleanUrl = coverUrl
                    .replace('http://', 'https://')
                    .replace('&edge=curl', '');

                this.logger.debug(`Found Google Books cover: ${cleanUrl}`);
                return cleanUrl;
            }

            return null;
        } catch (error) {
            this.logger.warn(`Google Books API fetch failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Extract cover image from PDF first page.
     */
    private async extractPdfCover(buffer: Buffer): Promise<Buffer | null> {
        try {
            const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
            const loadingTask = pdfjs.getDocument({ data: buffer });
            const pdfDoc = await loadingTask.promise;

            // Get first page
            const page = await pdfDoc.getPage(1);

            // Render at reasonable resolution for cover image
            const scale = 2.0; // Higher for better quality
            const viewport = page.getViewport({ scale });

            // Create canvas for rendering
            const { createCanvas } = await import('canvas');
            const canvas = createCanvas(viewport.width, viewport.height);
            const context = canvas.getContext('2d');

            // Render PDF page to canvas
            await page.render({
                canvasContext: context,
                viewport: viewport,
            }).promise;

            // Convert to JPEG buffer
            const imageBuffer = canvas.toBuffer('image/jpeg', { quality: 0.85 });

            this.logger.debug(`Rendered PDF cover: ${imageBuffer.length} bytes`);
            return imageBuffer;
        } catch (error) {
            this.logger.error(`PDF cover extraction failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Extract cover image from EPUB.
     * EPUBs typically have cover image in metadata or as first image.
     */
    private async extractEpubCover(buffer: Buffer): Promise<Buffer | null> {
        try {
            const epubModule = await import('epub-parser');
            const EPub = epubModule.default || epubModule;
            const epub = await EPub.parse(buffer);

            // Check for cover in metadata
            if (epub.metadata?.cover) {
                const coverPath = epub.metadata.cover;
                // Try to find the cover image in manifest
                if (epub.manifest) {
                    for (const item of Object.values(epub.manifest) as any[]) {
                        if (item.href === coverPath || item.id === 'cover-image') {
                            // Found cover, would need to extract it
                            // This depends on epub-parser implementation
                            this.logger.debug(`Found EPUB cover reference: ${item.href}`);
                        }
                    }
                }
            }

            // For now, return null - EPUB cover extraction is more complex
            // and may require a different library
            this.logger.debug('EPUB cover extraction not fully implemented');
            return null;
        } catch (error) {
            this.logger.error(`EPUB cover extraction failed: ${error.message}`);
            return null;
        }
    }
}
