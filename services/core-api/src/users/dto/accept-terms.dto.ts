import { IsString } from 'class-validator';

export class AcceptTermsDto {
    @IsString()
    termsVersion: string;

    @IsString()
    privacyPolicyVersion: string;
}
