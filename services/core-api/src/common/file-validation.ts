/**
 * File validation helpers.
 *
 * MIME types sent by clients are trivially spoofable, so for uploads we also
 * check the file's magic bytes, and we never trust the client-supplied filename
 * when building a storage key.
 */

const IMAGE_EXTENSIONS: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
};

/**
 * Returns a safe, whitelisted extension for an image upload based on its MIME
 * type — NOT on the client-supplied filename, which could inject path
 * separators into a storage key (e.g. "x.jpg/../../foo"). Defaults to "jpg".
 */
export function safeImageExtension(mimetype?: string): string {
    return (mimetype && IMAGE_EXTENSIONS[mimetype]) || 'jpg';
}

/**
 * Verifies that a buffer's leading bytes match the claimed content category.
 * Returns true when the magic bytes are consistent with the type.
 */
export function hasValidSignature(buffer: Buffer, category: 'image' | 'document'): boolean {
    if (!buffer || buffer.length < 4) return false;

    const startsWith = (...bytes: number[]) => bytes.every((b, i) => buffer[i] === b);

    if (category === 'image') {
        return (
            startsWith(0xff, 0xd8, 0xff) || // JPEG
            startsWith(0x89, 0x50, 0x4e, 0x47) || // PNG
            startsWith(0x47, 0x49, 0x46, 0x38) || // GIF87a/GIF89a
            // WEBP: "RIFF"...."WEBP"
            (startsWith(0x52, 0x49, 0x46, 0x46) &&
                buffer.length >= 12 &&
                buffer.slice(8, 12).toString('ascii') === 'WEBP')
        );
    }

    // document: PDF ("%PDF") or EPUB/ZIP ("PK\x03\x04")
    return (
        startsWith(0x25, 0x50, 0x44, 0x46) || // %PDF
        startsWith(0x50, 0x4b, 0x03, 0x04) // PK.. (zip-based, covers EPUB)
    );
}
