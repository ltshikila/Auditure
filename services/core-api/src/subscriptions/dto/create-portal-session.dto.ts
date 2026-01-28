import { IsOptional, IsString } from 'class-validator';

export class CreatePortalSessionDto {
    @IsOptional()
    @IsString()
    returnUrl?: string;
}
