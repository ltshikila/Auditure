import { IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class RateEpisodeDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;
}
