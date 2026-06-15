import { IsArray, ArrayNotEmpty, ArrayMaxSize, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ValidateChaptersDto {
    @IsArray()
    @ArrayNotEmpty()
    @ArrayMaxSize(1000)
    @Type(() => Number)
    @IsInt({ each: true })
    @Min(1, { each: true })
    chapters: number[];
}
