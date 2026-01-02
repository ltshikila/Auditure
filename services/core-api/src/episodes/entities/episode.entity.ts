// Episode entity - type definitions match Prisma schema
// This file is kept for NestJS convention but types are driven by Prisma

export class Episode {
    id: string;
    userId: string;
    podcasterId: string;
    bookId: string;
    title: string;
    description?: string;
    contentCoverage: string;
    chapters: number[];
    episodeType: string;
    episodeTheme: string;
    targetLengthMin: number;
    targetLengthMax: number;
    scriptContent?: string;
    audioFileKey?: string;
    generationStatus: string;
    scriptGeneratedAt?: Date;
    audioGeneratedAt?: Date;
    generationError?: string;
    duration?: number;
    audioFormat?: string;
    isPublic: boolean;
    playCount: number;
    likeCount: number;
    shareCount: number;
    createdAt: Date;
    updatedAt: Date;
}
