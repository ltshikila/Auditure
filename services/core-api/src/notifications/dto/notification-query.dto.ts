import { IsOptional, IsInt, Min, Max, IsBoolean, IsEnum, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { NotificationType } from '../interfaces/notification-payload.interface';

/**
 * Query DTO for fetching notifications with pagination and filtering
 */
export class NotificationQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    unreadOnly?: boolean = false;

    @IsOptional()
    @IsEnum(NotificationType)
    type?: NotificationType;
}

/**
 * DTO for registering/updating Expo push token
 */
export class RegisterPushTokenDto {
    @IsString()
    pushToken: string;
}

/**
 * DTO for marking notifications as read
 */
export class MarkNotificationsReadDto {
    @IsOptional()
    @IsString({ each: true })
    notificationIds?: string[];
}
