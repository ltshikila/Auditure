import { IsIn, IsOptional, IsBoolean } from 'class-validator';

export class CreateCheckoutSessionDto {
    @IsIn(['starter', 'pro'], { message: 'Tier must be either "starter" or "pro"' })
    tier: 'starter' | 'pro';

    @IsOptional()
    @IsBoolean()
    isUpgrade?: boolean;
}
