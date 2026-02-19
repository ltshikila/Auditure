import { Injectable, Logger } from '@nestjs/common';
import { normalizeBookTitle, titlesMatch as utilTitlesMatch } from '../utils/book-matching.utils';

export interface CoverExtractionResult {
    coverImageUrl: string | null;
    coverImageKey: string | null;
    source: 'google_books' | 'pdf_extraction' | 'epub_extraction' | null;
    genres: string[];
}

interface GoogleBooksResult {
    coverUrl: string | null;
    genres: string[];
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
        // 1. Try Google Books API first (also extracts genres/categories)
        const googleResult = await this.fetchGoogleBooksCover(metadata);
        if (googleResult?.coverUrl) {
            this.logger.log(`Found cover from Google Books for "${metadata.title}"`);
            if (googleResult.genres.length > 0) {
                this.logger.log(
                    `Found genres from Google Books: ${googleResult.genres.join(', ')}`,
                );
            }
            return {
                coverImageUrl: googleResult.coverUrl,
                coverImageKey: null, // External URL, no local storage
                source: 'google_books',
                genres: googleResult.genres,
            };
        }

        // 2. Try Open Library as fallback (better cover coverage for popular books)
        const openLibResult = await this.fetchOpenLibraryCover(metadata);
        if (openLibResult) {
            this.logger.log(`Found cover from Open Library for "${metadata.title}"`);
            return {
                coverImageUrl: openLibResult,
                coverImageKey: null,
                source: 'google_books', // Treat as external URL source
                genres: googleResult?.genres || [],
            };
        }

        // 3. Fall back to file extraction
        this.logger.log(`No API cover found, extracting from ${sourceType}...`);

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
                    genres: googleResult?.genres || [],
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
            genres: googleResult?.genres || [],
        };
    }

    /**
     * Lightweight probe: query Google Books for cover URL and genres
     * without downloading/extracting from the file itself.
     * Used by MetadataProbeService to check if better data is available.
     */
    async probeGoogleBooksCover(metadata: {
        title?: string;
        author?: string;
        isbn?: string;
    }): Promise<{ coverUrl: string | null; genres: string[] }> {
        const result = await this.fetchGoogleBooksCover(metadata);
        if (result?.coverUrl) {
            return result;
        }

        // Fallback: try Open Library
        const openLibCover = await this.fetchOpenLibraryCover(metadata);
        return {
            coverUrl: openLibCover,
            genres: result?.genres || [],
        };
    }

    /**
     * Fetch cover image URL from Open Library.
     * Free API, no key required. Better cover coverage than Google Books
     * for many popular titles.
     *
     * Strategy:
     * 1. Search by title + author
     * 2. Use the cover ID from the best matching result
     * 3. Validate the image isn't a placeholder (1x1 transparent pixel)
     */
    private async fetchOpenLibraryCover(metadata: {
        title?: string;
        author?: string;
        isbn?: string;
    }): Promise<string | null> {
        if (!metadata.title) return null;

        try {
            // Build search URL
            const params = new URLSearchParams({
                title: metadata.title,
                limit: '5',
                fields: 'title,author_name,cover_i,edition_count',
            });
            if (metadata.author) {
                params.set('author', metadata.author);
            }

            const url = `https://openlibrary.org/search.json?${params.toString()}`;
            this.logger.log(`Open Library search: "${metadata.title}" by "${metadata.author}"`);

            const response = await fetch(url);
            if (!response.ok) {
                this.logger.warn(`Open Library API error: ${response.status}`);
                return null;
            }

            const data = await response.json();
            if (!data.docs || data.docs.length === 0) {
                this.logger.log('No Open Library results found');
                return null;
            }

            // Find the best match with a cover
            for (const doc of data.docs) {
                if (!doc.cover_i) continue;

                // Verify title is a reasonable match
                const returnedTitle = (doc.title || '').toLowerCase();
                const expectedTitle = metadata.title.toLowerCase();
                if (
                    !returnedTitle.includes(expectedTitle) &&
                    !expectedTitle.includes(returnedTitle)
                ) {
                    continue;
                }

                const coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;

                // Validate: Open Library returns a 1x1 pixel for missing covers
                const imgResponse = await fetch(coverUrl);
                if (!imgResponse.ok) continue;

                const buffer = Buffer.from(await imgResponse.arrayBuffer());
                if (buffer.length < 1000) {
                    this.logger.log(
                        `Open Library cover too small (${buffer.length} bytes) — likely placeholder`,
                    );
                    continue;
                }

                this.logger.log(
                    `Found Open Library cover for "${doc.title}": ${coverUrl} (${buffer.length} bytes)`,
                );
                return coverUrl;
            }

            this.logger.log('No valid Open Library cover found');
            return null;
        } catch (error) {
            this.logger.warn(`Open Library API failed: ${error.message}`);
            return null;
        }
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
    }): Promise<GoogleBooksResult | null> {
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
            const result = await this.tryGoogleBooksQuery(query, metadata.title, metadata.author);
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
        return normalizeBookTitle(title);
    }

    /**
     * Check if two titles are similar enough to be considered a match.
     * Returns true if the normalized titles match or one contains the other.
     */
    private titlesMatch(expectedTitle: string, returnedTitle: string): boolean {
        return utilTitlesMatch(expectedTitle, returnedTitle);
    }

    /**
     * Words in a Google Books title that indicate a derivative/summary work.
     * These should be skipped in favor of the original book.
     */
    private static readonly DERIVATIVE_KEYWORDS = [
        'summary',
        'analysis',
        'workbook',
        'study guide',
        'companion',
        'cliff notes',
        'cliffnotes',
        'sparknotes',
        'book review',
        'book summary',
        'quick read',
        'key takeaways',
        'illustrated edition',
    ];

    /**
     * Check if a Google Books title indicates a summary/derivative work.
     */
    private isDerivativeWork(returnedTitle: string, expectedTitle: string): boolean {
        const normReturned = this.normalizeTitle(returnedTitle);
        const normExpected = this.normalizeTitle(expectedTitle);

        // If the returned title adds derivative keywords beyond the expected title, skip it
        const extra = normReturned.replace(normExpected, '').trim();
        if (!extra) return false; // Exact match or subset — not derivative

        return CoverExtractionService.DERIVATIVE_KEYWORDS.some(keyword => extra.includes(keyword));
    }

    /**
     * Score a Google Books result for how well it matches the expected book.
     * Higher score = better match. Returns -1 if the result should be rejected.
     */
    private scoreGoogleBooksResult(
        volumeInfo: any,
        expectedTitle: string,
        expectedAuthor?: string,
    ): number {
        const returnedTitle = volumeInfo?.title || '';
        const normExpected = this.normalizeTitle(expectedTitle);
        const normReturned = this.normalizeTitle(returnedTitle);

        let score = 0;

        // Exact title match is strongly preferred
        if (normExpected === normReturned) {
            score += 50;
        } else if (normExpected.includes(normReturned) || normReturned.includes(normExpected)) {
            // Containment match — but penalize if the returned title is much longer
            // (likely a derivative: "The Laws of Human Nature: Summary and Analysis")
            const lengthRatio = normReturned.length / normExpected.length;
            if (lengthRatio > 1.5) {
                score += 10; // Weak containment match
            } else {
                score += 30; // Close containment match (e.g. subtitle difference)
            }
        } else {
            return -1; // No title match at all
        }

        // Filter out derivative/summary works
        if (this.isDerivativeWork(returnedTitle, expectedTitle)) {
            this.logger.log(`    Derivative work detected: "${returnedTitle}"`);
            return -1;
        }

        // Author match bonus
        if (expectedAuthor && volumeInfo?.authors?.length > 0) {
            const returnedAuthors = volumeInfo.authors.join(' ').toLowerCase();
            const normAuthor = expectedAuthor.toLowerCase();
            if (returnedAuthors.includes(normAuthor) || normAuthor.includes(returnedAuthors)) {
                score += 20;
            }
        }

        // Page count: prefer substantial books over thin summaries/pamphlets
        const pageCount = volumeInfo?.pageCount || 0;
        if (pageCount >= 200) {
            score += 15;
        } else if (pageCount >= 100) {
            score += 10;
        } else if (pageCount > 0 && pageCount < 100) {
            score -= 25; // Strong penalty: likely a summary/abridged/sample edition
        }
        // pageCount === 0 means unknown, no bonus or penalty

        return score;
    }

    /**
     * Execute a single Google Books API query and extract cover URL.
     * Scores all matching results and picks the best one instead of first-match-wins.
     */
    private async tryGoogleBooksQuery(
        query: string,
        expectedTitle?: string,
        expectedAuthor?: string,
    ): Promise<GoogleBooksResult | null> {
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

            // Score all results and collect valid candidates
            const candidates: {
                score: number;
                volumeInfo: any;
                coverUrl: string;
            }[] = [];

            for (const item of data.items) {
                const volumeInfo = item.volumeInfo;
                const returnedTitle = volumeInfo?.title || '';
                const returnedAuthors = volumeInfo?.authors?.join(', ') || 'unknown';
                const imageLinks = volumeInfo?.imageLinks;
                const pageCount = volumeInfo?.pageCount || 0;

                this.logger.log(
                    `  Result: "${returnedTitle}" by ${returnedAuthors}, pages: ${pageCount}, hasImage: ${!!imageLinks}`,
                );

                // Skip results without images
                if (!imageLinks) {
                    this.logger.log(`    Skipping - no image`);
                    continue;
                }

                // Score this result
                if (expectedTitle) {
                    const score = this.scoreGoogleBooksResult(
                        volumeInfo,
                        expectedTitle,
                        expectedAuthor,
                    );
                    if (score < 0) {
                        this.logger.log(`    Skipping - rejected (score: ${score})`);
                        continue;
                    }

                    this.logger.log(`    Score: ${score}`);

                    // Prefer larger images: extraLarge > large > medium > small > thumbnail
                    const rawCoverUrl =
                        imageLinks.extraLarge ||
                        imageLinks.large ||
                        imageLinks.medium ||
                        imageLinks.small ||
                        imageLinks.thumbnail;

                    if (rawCoverUrl) {
                        candidates.push({ score, volumeInfo, coverUrl: rawCoverUrl });
                    }
                }
            }

            if (candidates.length === 0) {
                this.logger.debug(`No matching results with images for query: ${query}`);
                return null;
            }

            // Sort by score descending and try each (best first)
            candidates.sort((a, b) => b.score - a.score);

            // Reject candidates below minimum confidence threshold.
            // This prevents selecting low-quality matches (e.g. abridged editions
            // that happen to be the only result with a cover image).
            const MIN_SCORE = 50;
            const validCandidates = candidates.filter(c => c.score >= MIN_SCORE);
            if (validCandidates.length === 0) {
                this.logger.log(
                    `All candidates below minimum score ${MIN_SCORE} for query: ${query} (best: ${candidates[0]?.score})`,
                );
                return null;
            }

            for (const candidate of validCandidates) {
                const { volumeInfo, coverUrl: rawCoverUrl, score } = candidate;

                // Clean up the cover URL
                let cleanUrl = rawCoverUrl.replace('http://', 'https://').replace('&edge=curl', '');

                // Upgrade to higher resolution
                if (cleanUrl.includes('zoom=1')) {
                    cleanUrl = cleanUrl.replace('zoom=1', 'zoom=4');
                } else if (!cleanUrl.includes('zoom=')) {
                    cleanUrl += (cleanUrl.includes('?') ? '&' : '?') + 'zoom=4';
                }

                // Validate the image isn't a placeholder
                const isPlaceholder = await this.isGoogleBooksPlaceholder(cleanUrl);
                if (isPlaceholder) {
                    this.logger.warn(
                        `    Skipping best candidate "${volumeInfo.title}" (score: ${score}) - placeholder image`,
                    );
                    continue;
                }

                const categories: string[] = volumeInfo?.categories || [];
                this.logger.log(
                    `Selected Google Books cover: "${volumeInfo.title}" (score: ${score}, pages: ${volumeInfo.pageCount || '?'}, query: "${query}"): ${cleanUrl}`,
                );
                if (categories.length > 0) {
                    this.logger.log(`  Categories: ${categories.join(', ')}`);
                }
                return { coverUrl: cleanUrl, genres: categories };
            }

            this.logger.debug(`All candidates had placeholder images for query: ${query}`);
            return null;
        } catch (error) {
            this.logger.warn(`Google Books API fetch failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Check if a Google Books image URL returns a placeholder "image not available" image.
     * Google Books returns HTTP 200 with a valid PNG even when no cover exists —
     * the image is a mostly-white placeholder with gray "image not available" text.
     * Detection: placeholder images are almost entirely white, so they compress to
     * an extremely low ratio vs raw pixel size (< 3%). Real covers are 8-40%.
     */
    private async isGoogleBooksPlaceholder(imageUrl: string): Promise<boolean> {
        try {
            const response = await fetch(imageUrl);
            if (!response.ok) return true; // Can't fetch = treat as no cover

            const buffer = Buffer.from(await response.arrayBuffer());

            // PNG IHDR chunk: width at bytes 16-19, height at bytes 20-23 (big-endian)
            if (buffer.length < 24 || buffer[0] !== 0x89 || buffer[1] !== 0x50) {
                // Not a valid PNG — might still be JPEG, skip ratio check
                // but reject very small files (<5KB) as likely broken
                return buffer.length < 5000;
            }

            const width = buffer.readUInt32BE(16);
            const height = buffer.readUInt32BE(20);
            const rawPixelSize = width * height * 3; // RGB

            if (rawPixelSize === 0) return true;

            const compressionRatio = buffer.length / rawPixelSize;

            // Placeholder images compress to ~1.5-2% (mostly white pixels).
            // Real book covers typically compress to 8-40%.
            if (compressionRatio < 0.04) {
                this.logger.log(
                    `    Image appears to be a placeholder: ${width}x${height}, ${buffer.length} bytes, ratio=${(compressionRatio * 100).toFixed(1)}%`,
                );
                return true;
            }

            return false;
        } catch (error) {
            this.logger.warn(`Failed to validate Google Books image: ${error.message}`);
            return true; // If we can't validate, skip this cover
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
