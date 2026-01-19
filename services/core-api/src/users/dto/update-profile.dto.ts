import { IsString, IsOptional, IsDateString, MinLength, MaxLength } from 'class-validator';

export class UpdateProfileDto {
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(50)
    firstName?: string;

    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(50)
    lastName?: string;

    @IsOptional()
    @IsDateString()
    dateOfBirth?: string;
}
