import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';

export enum SourceType {
    PDF = 'PDF',
    EPUB = 'EPUB',
}

export class CreateBookDto {
    @IsString()
    @MaxLength(500)
    title: string;

    @IsString()
    @IsOptional()
    @MaxLength(200)
    author?: string;

    @IsString()
    @IsOptional()
    isbn?: string;

    @IsEnum(SourceType)
    sourceType: SourceType;

    @IsString()
    @IsOptional()
    language?: string;
}
