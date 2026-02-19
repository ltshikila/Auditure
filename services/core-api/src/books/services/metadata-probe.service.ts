import { Injectable, Logger } from '@nestjs/common';
import { TextExtractionService } from './text-extraction.service';
import { CoverExtractionService } from './cover-extraction.service';
import { cleanMetadataTitle, cleanMetadataAuthor } from '../utils/metadata-cleaning.utils';

export interface ProbeResult {
    reExtract: boolean;
    reason: string;
}

interface ExistingBookData {
    id: string;
    title: string;
    author: string | null;
    coverImageUrl: string | null;
    genres: string[];
    extractionStatus: string;
}

@Injectable()
export class MetadataProbeService {
    private readonly logger = new Logger(MetadataProbeService.name);

    constructor(
        private textExtractionService: TextExtractionService,
        private coverExtractionService: CoverExtractionService,
    ) {}

    /**
     * Extract the Google Books volume ID from a cover URL.
     * URLs look like: https://books.google.com/books/content?id=VOLUME_ID&...
     */
    private extractGoogleBooksVolumeId(url: string): string | null {
        const match = url.match(/[?&]id=([^&]+)/);
        return match ? match[1] : null;
    }

    /**
     * Determine whether re-extracting a book would produce better metadata
     * than what the existing canonical book already has.
     *
     * Runs a lightweight probe:
     * 1. Extract metadata from the uploaded file (no chapter detection)
     * 2. Query Google Books with cleaned metadata
     * 3. Compare against existing book's data
     *
     * Returns { reExtract: true, reason } if improvements are detected.
     */
    async shouldReExtract(
        fileBuffer: Buffer,
        sourceType: 'PDF' | 'EPUB',
        existingBook: ExistingBookData,
    ): Promise<ProbeResult> {
        // Don't probe books that are still being processed
        if (['PENDING', 'PROCESSING'].includes(existingBook.extractionStatus)) {
            return {
                reExtract: false,
                reason: 'Book is still being processed',
            };
        }

        try {
            // 1. Extract metadata from the uploaded file
            const metadata = await this.textExtractionService.extractMetadataOnly(
                fileBuffer,
                sourceType,
            );

            // 2. Clean metadata
            const probedTitle = metadata.title ? cleanMetadataTitle(metadata.title) : null;
            const probedAuthor = metadata.author ? cleanMetadataAuthor(metadata.author) : null;

            this.logger.log(
                `Probe metadata: title="${probedTitle}", author="${probedAuthor}" ` +
                    `(existing: title="${existingBook.title}", author="${existingBook.author}", ` +
                    `cover=${!!existingBook.coverImageUrl}, genres=${existingBook.genres?.length || 0})`,
            );

            // 3. Query Google Books with the best available title/author
            const searchTitle = probedTitle || existingBook.title;
            const searchAuthor = probedAuthor || existingBook.author;

            const googleResult = await this.coverExtractionService.probeGoogleBooksCover({
                title: searchTitle,
                author: searchAuthor || undefined,
            });

            // 4. Compare and decide
            const improvements: string[] = [];

            // Check: missing cover
            if (!existingBook.coverImageUrl && googleResult.coverUrl) {
                improvements.push('cover image available');
            }

            // Check: cover points to a different Google Books volume
            // (improved scoring/filtering may have found the correct book)
            if (existingBook.coverImageUrl && googleResult.coverUrl) {
                const existingVolumeId = this.extractGoogleBooksVolumeId(
                    existingBook.coverImageUrl,
                );
                const probedVolumeId = this.extractGoogleBooksVolumeId(googleResult.coverUrl);

                if (existingVolumeId && probedVolumeId && existingVolumeId !== probedVolumeId) {
                    improvements.push(
                        `cover source changed (volume ${existingVolumeId} → ${probedVolumeId})`,
                    );
                }
            }

            // Check: existing cover is from Google Books but scoring now rejects it
            // (the original match may have been a low-quality abridged/sample edition)
            if (existingBook.coverImageUrl && !googleResult.coverUrl) {
                const existingVolumeId = this.extractGoogleBooksVolumeId(
                    existingBook.coverImageUrl,
                );
                if (existingVolumeId) {
                    improvements.push(
                        `existing Google Books cover (${existingVolumeId}) no longer passes scoring`,
                    );
                }
            }

            // Check: missing author
            if (!existingBook.author && probedAuthor) {
                improvements.push(`author found: "${probedAuthor}"`);
            }

            // Check: missing genres
            if (
                (!existingBook.genres || existingBook.genres.length === 0) &&
                googleResult.genres.length > 0
            ) {
                improvements.push(`genres found: ${googleResult.genres.join(', ')}`);
            }

            // Check: title has junk that cleaning would fix
            if (probedTitle && probedTitle !== existingBook.title) {
                const existingCleaned = cleanMetadataTitle(existingBook.title);
                if (existingCleaned !== existingBook.title) {
                    improvements.push(
                        `title can be cleaned: "${existingBook.title}" → "${existingCleaned}"`,
                    );
                }
            }

            if (improvements.length > 0) {
                const reason = improvements.join('; ');
                this.logger.log(
                    `Probe detected improvements for "${existingBook.title}": ${reason}`,
                );
                return { reExtract: true, reason };
            }

            this.logger.log(
                `Probe found no improvements for "${existingBook.title}" — reusing existing`,
            );
            return {
                reExtract: false,
                reason: 'No improvements detected',
            };
        } catch (error) {
            this.logger.error(`Probe failed for "${existingBook.title}": ${error.message}`);
            // On probe failure, don't block the upload — just reuse existing
            return {
                reExtract: false,
                reason: `Probe error: ${error.message}`,
            };
        }
    }
}
