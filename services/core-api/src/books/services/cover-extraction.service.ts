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
                imageBuffer = this.extractEpubCover(fileBuffer);
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
     *
     * Search strategy (in order of preference):
     * 1. ISBN search (most accurate)
     * 2. Title + Author search
     * 3. Title only search (fallback - author metadata is often wrong)
     */
    private async fetchGoogleBooksCover(metadata: {
        title?: string;
        author?: string;
        isbn?: string;
    }): Promise<string | null> {
        // Log incoming metadata immediately
        this.logger.log(
            `[fetchGoogleBooksCover] Called with metadata: ${JSON.stringify(metadata)}`,
        );

        // Build list of queries to try in order
        const queries: string[] = [];

        // 1. ISBN search (most accurate)
        if (metadata.isbn) {
            queries.push(`isbn:${metadata.isbn}`);
        }

        // 2. Title + Author search
        if (metadata.title && metadata.author) {
            queries.push(
                `intitle:${encodeURIComponent(metadata.title)}+inauthor:${encodeURIComponent(metadata.author)}`,
            );
        }

        // 3. Title only search (fallback - PDF author metadata is often wrong/publisher name)
        if (metadata.title) {
            queries.push(`intitle:${encodeURIComponent(metadata.title)}`);
        }

        if (queries.length === 0) {
            this.logger.warn(
                `[fetchGoogleBooksCover] No queries could be built - no title/author/isbn in metadata`,
            );
            return null;
        }

        // Log what we're searching for
        this.logger.log(
            `Google Books search for: title="${metadata.title}", author="${metadata.author}", isbn="${metadata.isbn}"`,
        );
        this.logger.log(`Will try ${queries.length} queries: ${queries.join(' | ')}`);

        // Try each query until we find a cover
        for (const query of queries) {
            this.logger.log(`Trying Google Books query: ${query}`);
            const result = await this.tryGoogleBooksQuery(query, metadata.title);
            if (result) {
                return result;
            }
        }

        this.logger.warn(`No Google Books cover found after trying ${queries.length} queries`);
        return null;
    }

    /**
     * Normalize a title for comparison (lowercase, remove punctuation, collapse whitespace)
     */
    private normalizeTitle(title: string): string {
        return title
            .toLowerCase()
            .replace(/[^\w\s]/g, '') // Remove punctuation
            .replace(/\s+/g, ' ') // Collapse whitespace
            .trim();
    }

    /**
     * Check if two titles are similar enough to be considered a match.
     * Returns true if the normalized titles match or one contains the other.
     */
    private titlesMatch(expectedTitle: string, returnedTitle: string): boolean {
        const normalizedExpected = this.normalizeTitle(expectedTitle);
        const normalizedReturned = this.normalizeTitle(returnedTitle);

        // Exact match
        if (normalizedExpected === normalizedReturned) {
            return true;
        }

        // One contains the other (for subtitles, editions, etc.)
        if (
            normalizedReturned.includes(normalizedExpected) ||
            normalizedExpected.includes(normalizedReturned)
        ) {
            return true;
        }

        // Check if main title matches (before colon/dash)
        const expectedMain = normalizedExpected.split(/[:\-–—]/)[0].trim();
        const returnedMain = normalizedReturned.split(/[:\-–—]/)[0].trim();
        if (expectedMain === returnedMain && expectedMain.length > 5) {
            return true;
        }

        return false;
    }

    /**
     * Execute a single Google Books API query and extract cover URL.
     * Validates that the returned book title matches the expected title.
     */
    private async tryGoogleBooksQuery(
        query: string,
        expectedTitle?: string,
    ): Promise<string | null> {
        try {
            const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=5`;
            this.logger.debug(`Google Books API query: ${url}`);

            const response = await fetch(url);
            if (!response.ok) {
                this.logger.warn(`Google Books API error: ${response.status}`);
                return null;
            }

            const data = await response.json();

            if (data.totalItems === 0 || !data.items || data.items.length === 0) {
                this.logger.log(`No results for query: ${query}`);
                return null;
            }

            this.logger.log(`Got ${data.items.length} results from Google Books`);

            // Find the first result that matches the expected title and has an image
            for (const item of data.items) {
                const volumeInfo = item.volumeInfo;
                const returnedTitle = volumeInfo?.title;
                const returnedAuthors = volumeInfo?.authors?.join(', ') || 'unknown';
                const imageLinks = volumeInfo?.imageLinks;

                this.logger.log(
                    `  Result: "${returnedTitle}" by ${returnedAuthors}, hasImage: ${!!imageLinks}`,
                );

                // Skip results without images
                if (!imageLinks) {
                    this.logger.log(`    Skipping - no image`);
                    continue;
                }

                // Validate title match if expected title provided
                if (expectedTitle && returnedTitle) {
                    if (!this.titlesMatch(expectedTitle, returnedTitle)) {
                        this.logger.log(
                            `    Skipping - title mismatch: expected "${expectedTitle}"`,
                        );
                        continue;
                    }
                    this.logger.log(`    Title match confirmed!`);
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
                    let cleanUrl = coverUrl
                        .replace('http://', 'https://')
                        .replace('&edge=curl', '');

                    // Upgrade to higher resolution if possible
                    // Google Books zoom parameter: 1=128px, 2=256px, 3=512px, 4=800px
                    // Replace zoom=1 with zoom=4 for highest resolution
                    if (cleanUrl.includes('zoom=1')) {
                        cleanUrl = cleanUrl.replace('zoom=1', 'zoom=4');
                    } else if (!cleanUrl.includes('zoom=')) {
                        // Add zoom parameter if not present
                        cleanUrl += (cleanUrl.includes('?') ? '&' : '?') + 'zoom=4';
                    }

                    this.logger.log(
                        `Found Google Books cover for "${returnedTitle}" (query: "${query}"): ${cleanUrl}`,
                    );
                    return cleanUrl;
                }
            }

            this.logger.debug(`No matching results with images for query: ${query}`);
            return null;
        } catch (error) {
            this.logger.warn(`Google Books API fetch failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Extract cover image from PDF first page.
     * Tries multiple methods:
     * 1. Extract embedded images from the first page
     * 2. Fall back to rendering the first page (may not work in all environments)
     */
    private async extractPdfCover(buffer: Buffer): Promise<Buffer | null> {
        try {
            const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
            // pdfjs-dist requires Uint8Array, not Node.js Buffer
            const uint8Array = new Uint8Array(buffer);
            const loadingTask = pdfjs.getDocument({ data: uint8Array });
            const pdfDoc = await loadingTask.promise;

            // Get first page
            const page = await pdfDoc.getPage(1);

            // Method 1: Try to extract embedded images from the page
            try {
                const operatorList = await page.getOperatorList();
                const imageObjects: any[] = [];

                // Look for image objects in the operator list
                for (let i = 0; i < operatorList.fnArray.length; i++) {
                    const fn = operatorList.fnArray[i];
                    // OPS.paintImageXObject = 85, OPS.paintJpegXObject = 82
                    if (fn === 85 || fn === 82) {
                        const imgName = operatorList.argsArray[i][0];
                        imageObjects.push(imgName);
                    }
                }

                this.logger.debug(`Found ${imageObjects.length} image objects on first page`);

                // If there are images, try to extract the first/largest one
                if (imageObjects.length > 0) {
                    const objs = page.objs;
                    for (const imgName of imageObjects) {
                        try {
                            const img = await new Promise<any>((resolve, reject) => {
                                objs.get(imgName, resolve);
                                setTimeout(() => reject(new Error('Timeout')), 5000);
                            });

                            if (img && img.data && img.width && img.height) {
                                // Convert raw image data to JPEG using canvas
                                const { createCanvas, createImageData } = await import('canvas');
                                const imgCanvas = createCanvas(img.width, img.height);
                                const imgContext = imgCanvas.getContext('2d');

                                // Create ImageData from raw pixel data
                                const channels = img.data.length / (img.width * img.height);
                                let imageDataArray: Uint8ClampedArray;

                                if (channels === 4) {
                                    // RGBA - use directly
                                    imageDataArray = new Uint8ClampedArray(img.data);
                                } else if (channels === 3) {
                                    // RGB - convert to RGBA
                                    imageDataArray = new Uint8ClampedArray(
                                        img.width * img.height * 4,
                                    );
                                    for (let i = 0, j = 0; i < img.data.length; i += 3, j += 4) {
                                        imageDataArray[j] = img.data[i]; // R
                                        imageDataArray[j + 1] = img.data[i + 1]; // G
                                        imageDataArray[j + 2] = img.data[i + 2]; // B
                                        imageDataArray[j + 3] = 255; // A
                                    }
                                } else if (channels === 1) {
                                    // Grayscale - convert to RGBA
                                    imageDataArray = new Uint8ClampedArray(
                                        img.width * img.height * 4,
                                    );
                                    for (let i = 0, j = 0; i < img.data.length; i++, j += 4) {
                                        imageDataArray[j] = img.data[i]; // R
                                        imageDataArray[j + 1] = img.data[i]; // G
                                        imageDataArray[j + 2] = img.data[i]; // B
                                        imageDataArray[j + 3] = 255; // A
                                    }
                                } else {
                                    continue; // Skip unsupported format
                                }

                                const imageData = createImageData(
                                    imageDataArray,
                                    img.width,
                                    img.height,
                                );
                                imgContext.putImageData(imageData, 0, 0);

                                const imageBuffer = imgCanvas.toBuffer('image/jpeg', {
                                    quality: 0.85,
                                });
                                this.logger.log(
                                    `Extracted embedded image from PDF: ${img.width}x${img.height}, ${imageBuffer.length} bytes`,
                                );
                                return imageBuffer;
                            }
                        } catch (imgError) {
                            this.logger.debug(
                                `Failed to extract image ${imgName}: ${imgError.message}`,
                            );
                        }
                    }
                }
            } catch (extractError) {
                this.logger.debug(`Embedded image extraction failed: ${extractError.message}`);
            }

            // Method 2: Try rendering with canvas (may fail in some environments)
            try {
                const scale = 2.0;
                const viewport = page.getViewport({ scale });
                const { createCanvas } = await import('canvas');
                const canvas = createCanvas(viewport.width, viewport.height);
                const context = canvas.getContext('2d');

                await page.render({
                    canvasContext: context as any,
                    viewport: viewport,
                    canvas: canvas as any,
                }).promise;

                const imageBuffer = canvas.toBuffer('image/jpeg', { quality: 0.85 });
                this.logger.log(`Rendered PDF cover via canvas: ${imageBuffer.length} bytes`);
                return imageBuffer;
            } catch (renderError) {
                this.logger.debug(`Canvas rendering failed: ${renderError.message}`);
            }

            this.logger.warn('All PDF cover extraction methods failed');
            return null;
        } catch (error) {
            this.logger.error(`PDF cover extraction failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Extract cover image from EPUB.
     * Note: @gxl/epub-parser doesn't directly expose cover images,
     * so we rely on Google Books API for EPUB covers.
     */
    private extractEpubCover(_buffer: Buffer): Buffer | null {
        // EPUB cover extraction requires parsing the OPF manifest and extracting
        // the referenced image file from the ZIP archive. The @gxl/epub-parser
        // library doesn't expose this functionality directly.
        // For EPUBs, we rely on Google Books API for cover images instead.
        this.logger.debug('EPUB cover extraction deferred to Google Books API');
        return null;
    }
}
