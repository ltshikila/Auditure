export interface BookExtractionJob {
    bookId: string;
    userId: string;
    fileStorageKey: string;
    sourceType: 'PDF' | 'EPUB';
}

export interface EpisodeGenerationJob {
    episodeId: string;
    userId: string;
    podcasterId: string;
    bookId: string;
    title: string;
    contentCoverage: 'ENTIRE_BOOK' | 'MULTIPLE_CHAPTERS' | 'SINGLE_CHAPTER';
    chapters: number[];
    episodeType: 'MONOLOGUE' | 'DUO';
    episodeTheme: 'LECTURE' | 'DISCUSSION' | 'DEBATE';
    targetLengthMin: number;
    targetLengthMax: number;
    voiceTier: 'STANDARD' | 'GEMINI';
}
