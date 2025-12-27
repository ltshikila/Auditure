import { IsArray, IsInt, Min, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class GetTextDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
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
