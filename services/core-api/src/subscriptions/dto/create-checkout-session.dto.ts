import { IsIn } from 'class-validator';

export class CreateCheckoutSessionDto {
    @IsIn(['starter', 'pro'], { message: 'Tier must be either "starter" or "pro"' })
    tier: 'starter' | 'pro';
}
