import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Shared query DTO for simple "list with a limit" endpoints
 * (trending / by-podcaster / by-book). Bounds the limit so callers
 * can't request an unbounded page size.
 */
export class ListLimitQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;
}
