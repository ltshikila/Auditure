/**
 * Text Extraction Test Script
 *
 * Run with: npx ts-node scripts/test-extraction.ts
 *
 * Tests the text extraction service against PDF files in test/files/
 */

import * as fs from 'fs';
import * as path from 'path';

// Import the extraction service
import { TextExtractionService, ExtractedContent } from '../src/books/services/text-extraction.service';

const TEST_FILES_DIR = path.join(__dirname, '..', 'test', 'files');

interface ExtractionResult {
    filename: string;
    success: boolean;
    method?: string;
    metadata?: {
        title?: string;
        author?: string;
        pageCount?: number;
    };
    stats?: {
        fullTextLength: number;
        fullTextWords: number;
        chapterCount: number;
        avgChapterLength: number;
    };
    chapters?: Array<{
        number: number;
        title: string;
        textLength: number;
        preview: string;
    }>;
    error?: string;
    durationMs: number;
}

async function testExtraction(filePath: string): Promise<ExtractionResult> {
    const filename = path.basename(filePath);
    const startTime = Date.now();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📄 Processing: ${filename}`);
    console.log(`${'='.repeat(60)}`);

    try {
        // Read file
        const buffer = fs.readFileSync(filePath);
        console.log(`   File size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

        // Create service instance
        const service = new TextExtractionService();

        // Extract based on file type
        let extracted: ExtractedContent;
        const ext = path.extname(filePath).toLowerCase();

        if (ext === '.pdf') {
            extracted = await service.extractFromPdf(buffer);
        } else if (ext === '.epub') {
            extracted = await service.extractFromEpub(buffer);
        } else {
            throw new Error(`Unsupported file type: ${ext}`);
        }

        const durationMs = Date.now() - startTime;

        // Calculate stats
        const wordCount = extracted.fullText.split(/\s+/).filter(w => w.length > 0).length;
        const avgChapterLength = extracted.chapters.length > 0
            ? Math.round(extracted.chapters.reduce((sum, ch) => sum + ch.text.length, 0) / extracted.chapters.length)
            : 0;

        // Print results
        console.log(`\n   ✅ Extraction successful!`);
        console.log(`   Method: ${extracted.extractionMethod}`);
        console.log(`   Duration: ${(durationMs / 1000).toFixed(2)}s`);
        console.log(`\n   📊 Metadata:`);
        console.log(`      Title: ${extracted.metadata.title || '(not found)'}`);
        console.log(`      Author: ${extracted.metadata.author || '(not found)'}`);
        console.log(`      Pages: ${extracted.metadata.pageCount || '(unknown)'}`);

        console.log(`\n   📈 Statistics:`);
        console.log(`      Full text length: ${extracted.fullText.length.toLocaleString()} chars`);
        console.log(`      Word count: ${wordCount.toLocaleString()} words`);
        console.log(`      Chapters detected: ${extracted.chapters.length}`);
        console.log(`      Avg chapter length: ${avgChapterLength.toLocaleString()} chars`);

        console.log(`\n   📚 Chapters:`);
        extracted.chapters.forEach((chapter, i) => {
            const preview = chapter.text.substring(0, 100).replace(/\s+/g, ' ').trim();
            console.log(`      ${i + 1}. [Ch ${chapter.chapterNumber}] "${chapter.title}" (${chapter.text.length.toLocaleString()} chars)`);
            console.log(`         Preview: "${preview}..."`);
        });

        // Show text sample
        console.log(`\n   📝 Text Sample (first 500 chars):`);
        const sample = extracted.fullText.substring(0, 500).replace(/\s+/g, ' ').trim();
        console.log(`      "${sample}..."`);

        return {
            filename,
            success: true,
            method: extracted.extractionMethod,
            metadata: extracted.metadata,
            stats: {
                fullTextLength: extracted.fullText.length,
                fullTextWords: wordCount,
                chapterCount: extracted.chapters.length,
                avgChapterLength,
            },
            chapters: extracted.chapters.map(ch => ({
                number: ch.chapterNumber,
                title: ch.title || `Chapter ${ch.chapterNumber}`,
                textLength: ch.text.length,
                preview: ch.text.substring(0, 100).replace(/\s+/g, ' ').trim(),
            })),
            durationMs,
        };

    } catch (error) {
        const durationMs = Date.now() - startTime;
        console.log(`\n   ❌ Extraction failed!`);
        console.log(`   Error: ${error.message}`);

        return {
            filename,
            success: false,
            error: error.message,
            durationMs,
        };
    }
}

async function main() {
    console.log('\n🔬 TEXT EXTRACTION TEST SUITE');
    console.log('━'.repeat(60));
    console.log(`Test directory: ${TEST_FILES_DIR}`);

    // Check if directory exists
    if (!fs.existsSync(TEST_FILES_DIR)) {
        console.error(`\n❌ Test files directory not found: ${TEST_FILES_DIR}`);
        process.exit(1);
    }

    // Find test files
    const files = fs.readdirSync(TEST_FILES_DIR)
        .filter(f => ['.pdf', '.epub'].includes(path.extname(f).toLowerCase()))
        .map(f => path.join(TEST_FILES_DIR, f));

    if (files.length === 0) {
        console.error('\n❌ No PDF or EPUB files found in test directory');
        process.exit(1);
    }

    console.log(`Found ${files.length} file(s) to test\n`);

    // Process each file
    const results: ExtractionResult[] = [];
    for (const file of files) {
        const result = await testExtraction(file);
        results.push(result);
    }

    // Print summary
    console.log(`\n\n${'═'.repeat(60)}`);
    console.log('📊 SUMMARY');
    console.log('═'.repeat(60));

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`\n   Total files: ${results.length}`);
    console.log(`   ✅ Successful: ${successful.length}`);
    console.log(`   ❌ Failed: ${failed.length}`);

    if (successful.length > 0) {
        console.log('\n   Successful extractions:');
        successful.forEach(r => {
            console.log(`      • ${r.filename}`);
            console.log(`        Method: ${r.method}, Chapters: ${r.stats?.chapterCount}, Words: ${r.stats?.fullTextWords.toLocaleString()}`);
        });
    }

    if (failed.length > 0) {
        console.log('\n   Failed extractions:');
        failed.forEach(r => {
            console.log(`      • ${r.filename}: ${r.error}`);
        });
    }

    // Save results to JSON
    const resultsPath = path.join(__dirname, '..', 'test', 'extraction-results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n   Results saved to: ${resultsPath}`);

    console.log('\n' + '━'.repeat(60));
    console.log('🏁 Test complete!\n');

    // Exit with error code if any failed
    if (failed.length > 0) {
        process.exit(1);
    }
}

main().catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
});
