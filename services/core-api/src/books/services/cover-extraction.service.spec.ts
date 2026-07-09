import JSZip from 'jszip';
import { CoverExtractionService } from './cover-extraction.service';

/**
 * Build a minimal valid EPUB (ZIP) in memory for cover-extraction tests.
 * @param opf         the content.opf body (manifest + metadata)
 * @param coverBytes  bytes to store at OEBPS/images/cover.jpg (omit to leave it out)
 * @param coverPath   path of the cover image inside the archive
 */
async function buildEpub(
    opf: string,
    coverBytes: Buffer | null = Buffer.alloc(2048, 0x7f),
    coverPath = 'OEBPS/images/cover.jpg',
): Promise<Buffer> {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');
    zip.file(
        'META-INF/container.xml',
        `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
    );
    zip.file('OEBPS/content.opf', opf);
    if (coverBytes) zip.file(coverPath, coverBytes);
    return zip.generateAsync({ type: 'nodebuffer' });
}

describe('CoverExtractionService', () => {
    let service: CoverExtractionService;

    beforeEach(() => {
        service = new CoverExtractionService();
    });

    describe('buildSearchTitle', () => {
        const strip = (t: string) => (service as any).buildSearchTitle(t);

        it('strips trailing series/edition parentheticals', () => {
            expect(strip('Sunrise on the Reaping (A Hunger Games Novel) (The Hunger Games)')).toBe(
                'Sunrise on the Reaping',
            );
        });

        it('strips bracket groups too', () => {
            expect(strip('Dune [Unabridged]')).toBe('Dune');
        });

        it('leaves clean titles untouched', () => {
            expect(strip('The Great Gatsby')).toBe('The Great Gatsby');
        });

        it('falls back to original when stripping empties the title', () => {
            expect(strip('(Boxed Set)')).toBe('(Boxed Set)');
        });
    });

    describe('extractEpubCover', () => {
        const extract = (buf: Buffer): Promise<Buffer | null> =>
            (service as any).extractEpubCover(buf);

        it('extracts cover via <meta name="cover"> (EPUB2 style)', async () => {
            const opf = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0">
  <metadata><meta name="cover" content="cover-img"/></metadata>
  <manifest>
    <item id="cover-img" href="images/cover.jpg" media-type="image/jpeg"/>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
</package>`;
            const epub = await buildEpub(opf);
            const cover = await extract(epub);
            expect(cover).toBeInstanceOf(Buffer);
            expect(cover!.length).toBe(2048);
        });

        it('extracts cover via EPUB3 properties="cover-image"', async () => {
            const opf = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata/>
  <manifest>
    <item id="c" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>
  </manifest>
</package>`;
            const epub = await buildEpub(opf);
            const cover = await extract(epub);
            expect(cover).toBeInstanceOf(Buffer);
            expect(cover!.length).toBe(2048);
        });

        it('resolves ../ relative hrefs against the OPF directory', async () => {
            // OPF references ../images/cover.jpg; archive stores it at top-level images/
            const opf = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <manifest>
    <item id="c" href="../images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>
  </manifest>
</package>`;
            const epub = await buildEpub(opf, Buffer.alloc(1500, 0x42), 'images/cover.jpg');
            const cover = await extract(epub);
            expect(cover).toBeInstanceOf(Buffer);
            expect(cover!.length).toBe(1500);
        });

        it('returns null when the manifest references no cover image', async () => {
            const opf = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <manifest>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
</package>`;
            const epub = await buildEpub(opf, null);
            expect(await extract(epub)).toBeNull();
        });

        it('returns null (not throw) on a non-EPUB buffer', async () => {
            expect(await extract(Buffer.from('not a zip'))).toBeNull();
        });
    });

    describe('fetchWithRetry', () => {
        afterEach(() => jest.restoreAllMocks());

        it('retries on 429 then succeeds', async () => {
            const ok = { ok: true, status: 200 } as Response;
            const rateLimited = { ok: false, status: 429 } as Response;
            const spy = jest
                .spyOn(global, 'fetch')
                .mockResolvedValueOnce(rateLimited as any)
                .mockResolvedValueOnce(ok as any);

            const res = await (service as any).fetchWithRetry('https://example.test');
            expect(res.status).toBe(200);
            expect(spy).toHaveBeenCalledTimes(2);
        });

        it('gives up after maxAttempts and returns the last response', async () => {
            const rateLimited = { ok: false, status: 429 } as Response;
            const spy = jest.spyOn(global, 'fetch').mockResolvedValue(rateLimited as any);

            const res = await (service as any).fetchWithRetry('https://example.test', 2);
            expect(res.status).toBe(429);
            expect(spy).toHaveBeenCalledTimes(2);
        });
    });
});
