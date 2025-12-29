import { IsArray, IsInt, Min, IsOptional, IsString } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class GetTextDto {
    @IsOptional()
    @Transform(({ value }) => {
        if (!value) return undefined;
        return Array.isArray(value) ? value : [value];
    })
    @IsArray()
    @IsString({ each: true })
    chapterIds?: string[];

    @IsInt()
    @Min(1)
    @IsOptional()
    @Type(() => Number)
    startPage?: number;

    @IsInt()
    @Min(1)
    @IsOptional()
    @Type(() => Number)
    endPage?: number;
}
