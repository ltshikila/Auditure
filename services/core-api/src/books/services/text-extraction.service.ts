import { Injectable } from '@nestjs/common';
import * as he from 'he';

export interface ExtractedContent {
  fullText: string;
  chapters: ChapterData[];
  metadata: {
    title?: string;
    author?: string;
    pageCount?: number;
    language?: string;
  };
}

export interface ChapterData {
  chapterNumber: number;
  title?: string;
  text: string;
  startPage?: number;
  endPage?: number;
}

@Injectable()
export class TextExtractionService {
  async extractFromPdf(buffer: Buffer): Promise<ExtractedContent> {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);

    const metadata = {
      title: data.info?.Title,
      author: data.info?.Author,
      pageCount: data.numpages,
    };

    const fullText = this.cleanText(data.text);
    const chapters = this.detectChaptersInText(fullText);

    return {
      fullText,
      chapters: chapters.length > 0 ? chapters : this.createDefaultChapter(fullText),
      metadata,
    };
  }

  async extractFromEpub(buffer: Buffer): Promise<ExtractedContent> {
    // Note: epub-parser usage - it's a CommonJS module
    const EPub = require('epub-parser');
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
        const text = this.cleanText(this.stripHtml(section.htmlString || section.content || ''));

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
    return [{
      chapterNumber: 1,
      title: 'Full Book',
      text: fullText,
    }];
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
    return html.replace(/<[^>]*>/g, ' ')
               .replace(/&nbsp;/g, ' ')
               .replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>');
  }
}
