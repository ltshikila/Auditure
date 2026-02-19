/**
 * Shared metadata cleaning utilities for PDF/EPUB metadata.
 * Used by BookExtractionWorker and MetadataProbeService.
 */

/**
 * Clean junk from PDF/EPUB metadata titles.
 * Common issues:
 * - Download site tags: "(PDFDrive.com)", "[BooksLD]", "(z-lib.org)"
 * - File extensions: ".pdf", ".epub"
 * - Edition noise: "- Free PDF", "(Original)", "_ OceanofPDF.com"
 */
export function cleanMetadataTitle(title: string): string {
    if (!title) return title;

    let cleaned = title;

    // Remove common download site tags in parentheses/brackets
    cleaned = cleaned.replace(
        /\s*[\(\[\{]\s*(PDFDrive\.com|PDFDrive|z-lib\.org|z-lib|zlibrary|libgen|BooksLD|OceanofPDF\.com|OceanofPDF|epubBooks|AllBooksWorld|Free-eBooks\.net|MustRead|b-ok\.org|b-ok|bookrix|ebook3000)\s*[\)\]\}]/gi,
        '',
    );

    // Remove download site tags without brackets (e.g. "_ OceanofPDF.com")
    cleaned = cleaned.replace(
        /\s*[_\-|]\s*(PDFDrive\.com|PDFDrive|z-lib\.org|OceanofPDF\.com|OceanofPDF|BooksLD|Free-eBooks\.net)\s*$/gi,
        '',
    );

    // Remove file extensions
    cleaned = cleaned.replace(/\.(pdf|epub|mobi|azw3?|txt|docx?)$/gi, '');

    // Remove trailing "- Free PDF", "- Free Download", etc.
    cleaned = cleaned.replace(/\s*[-_]\s*Free\s*(PDF|Download|eBook)?\s*$/gi, '');

    // Clean up multiple spaces and trim
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned || title; // Fallback to original if cleaning emptied it
}

/**
 * Clean junk from PDF/EPUB metadata author fields.
 * Common issues:
 * - Publisher names instead of authors: "Penguin Random House", "HarperCollins"
 * - Software names: "Microsoft Word", "Adobe InDesign", "calibre"
 * - Download site attribution: "PDFDrive.com"
 *
 * Returns null if the author is rejected (not a real person name).
 */
export function cleanMetadataAuthor(author: string): string | null {
    if (!author) return null;

    const cleaned = author.trim();

    // Reject if it looks like a software/tool name
    const softwarePatterns = [
        /^microsoft/i,
        /^adobe/i,
        /^calibre/i,
        /^writer$/i,
        /^unknown$/i,
        /^author$/i,
        /^none$/i,
        /^n\/a$/i,
    ];
    if (softwarePatterns.some((p) => p.test(cleaned))) {
        return null;
    }

    // Reject if it looks like a download site
    if (/\.(com|org|net|io)$/i.test(cleaned)) {
        return null;
    }

    // Reject if it looks like a publisher (common publisher keywords)
    const publisherPatterns = [
        /\b(publishing|publishers|publications|press|books|media|group|inc|ltd|llc|corp)\b/i,
        /^(penguin|harpercollins|simon|macmillan|hachette|wiley|elsevier|springer|oxford|cambridge)/i,
    ];
    if (publisherPatterns.some((p) => p.test(cleaned))) {
        return null;
    }

    return cleaned;
}
