/**
 * Shared book title/author normalization and matching utilities.
 * Used by feed service, books service, cover extraction, and extraction worker.
 */

/**
 * Normalize a book title for comparison.
 * Lowercase, remove punctuation, collapse whitespace.
 */
export function normalizeBookTitle(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ') // Collapse whitespace
        .trim();
}

/**
 * Normalize an author name for comparison.
 * Lowercase, remove punctuation, collapse whitespace, handle "Last, First" format.
 */
export function normalizeAuthor(
    author: string | null | undefined,
): string | null {
    if (!author) return null;
    let normalized = author.toLowerCase().trim();
    // Handle "Last, First" -> "first last"
    if (normalized.includes(',')) {
        const parts = normalized.split(',').map((p) => p.trim());
        normalized = parts.reverse().join(' ');
    }
    return normalized
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Check if two book titles match using fuzzy comparison.
 * Handles subtitles (colons, dashes), containment, and main-title matching.
 */
export function titlesMatch(titleA: string, titleB: string): boolean {
    const normA = normalizeBookTitle(titleA);
    const normB = normalizeBookTitle(titleB);

    // Exact match
    if (normA === normB) return true;

    // Containment — but only if the shorter title is a significant portion of the longer.
    // "Dune" (4 chars) matching "Dune Messiah" (12 chars) = 33% → reject.
    // "A Game of Thrones" in "A Game of Thrones A Song of Ice and Fire" → 45%, but
    // that case is caught by the main-title match below. This check handles cases like
    // "Frankenstein" vs "Frankenstein or the Modern Prometheus" (37%) — those are caught
    // by main-title match too. So we use a high threshold here to avoid false positives.
    const shorter = normA.length <= normB.length ? normA : normB;
    const longer = normA.length > normB.length ? normA : normB;
    if (longer.includes(shorter) && shorter.length / longer.length >= 0.7) return true;

    // Main title match (before colon/dash separator)
    const mainA = normA.split(/[:\-\u2013\u2014]/)[0].trim();
    const mainB = normB.split(/[:\-\u2013\u2014]/)[0].trim();
    if (mainA === mainB && mainA.length > 5) return true;

    return false;
}

/**
 * Check if two authors match.
 * Null/empty authors are treated as wildcards (match anything).
 */
export function authorsMatch(
    authorA: string | null | undefined,
    authorB: string | null | undefined,
): boolean {
    const normA = normalizeAuthor(authorA);
    const normB = normalizeAuthor(authorB);

    // Both null/empty -> match
    if (!normA && !normB) return true;

    // One null, one present -> match (don't reject on missing author)
    if (!normA || !normB) return true;

    // Exact normalized match
    if (normA === normB) return true;

    // Containment (e.g. "George R R Martin" vs "George Martin")
    if (normA.includes(normB) || normB.includes(normA)) return true;

    return false;
}

/**
 * Check if two books are the "same" book (title + author match).
 */
export function booksMatch(
    bookA: { title: string; author?: string | null },
    bookB: { title: string; author?: string | null },
): boolean {
    return (
        titlesMatch(bookA.title, bookB.title) &&
        authorsMatch(bookA.author, bookB.author)
    );
}

/**
 * Input for computing a book's quality score.
 * All fields optional — omitted fields contribute 0 to the score.
 */
export interface BookQualityInput {
    extractionStatus?: string;
    coverImageUrl?: string | null;
    author?: string | null;
    isbn?: string | null;
    pageCount?: number | null;
    genres?: string[];
    chapterCount?: number;
    avgChapterLength?: number;
}

/**
 * Compute a quality score for a book based on metadata completeness
 * and chapter extraction quality. Higher score = better quality.
 *
 * Used to determine which copy of a duplicated book should be the
 * "canonical" version that episodes reference.
 */
export function computeBookQualityScore(book: BookQualityInput): number {
    let score = 0;

    // Extraction status (COMPLETED is strongly preferred)
    if (book.extractionStatus === 'COMPLETED') score += 10;
    else if (book.extractionStatus === 'PARTIALLY_COMPLETED') score += 3;

    // Metadata completeness
    if (book.coverImageUrl) score += 10;
    if (book.author) score += 5;
    if (book.isbn) score += 3;
    if (book.pageCount && book.pageCount > 0) score += 3;

    // Genres from Google Books
    if (book.genres && book.genres.length > 0) {
        score += Math.min(book.genres.length, 5);
    }

    // Chapter count — more chapters = better TOC detection (capped at 30)
    if (book.chapterCount) {
        score += Math.min(book.chapterCount, 30);
    }

    // Average chapter text length — longer chapters = better extraction
    // 1 point per 1000 chars average, up to 10 points
    if (book.avgChapterLength && book.avgChapterLength > 0) {
        score += Math.min(Math.floor(book.avgChapterLength / 1000), 10);
    }

    return score;
}
