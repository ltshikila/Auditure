import { IsEmail, IsString, MinLength, IsDateString } from 'class-validator';

export class RegisterDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsDateString()
  dateOfBirth: string;

  @IsString()
  @MinLength(6)
  password: string;
}