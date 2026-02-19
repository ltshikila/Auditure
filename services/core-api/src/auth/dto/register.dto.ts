import { IsEmail, IsString, MinLength, IsDateString, IsOptional } from 'class-validator';

export class RegisterDto {
    @IsString()
    firstName: string;

    @IsString()
    lastName: string;

    @IsEmail()
    email: string;

    @IsOptional()
    @IsDateString()
    dateOfBirth?: string;

    @IsString()
    @MinLength(6)
    password: string;
}
