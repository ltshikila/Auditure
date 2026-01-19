import { IsOptional, IsBoolean, IsEnum, IsNumber, Min, Max } from 'class-validator';

export enum ThemePreference {
    LIGHT = 'LIGHT',
    DARK = 'DARK',
    SYSTEM = 'SYSTEM',
}

export class UpdateSettingsDto {
    // Theme
    @IsOptional()
    @IsEnum(ThemePreference)
    theme?: ThemePreference;

    // Notifications
    @IsOptional()
    @IsBoolean()
    pushNotificationsEnabled?: boolean;

    @IsOptional()
    @IsBoolean()
    emailNotificationsEnabled?: boolean;

    @IsOptional()
    @IsBoolean()
    marketingEmailsEnabled?: boolean;

    // Privacy
    @IsOptional()
    @IsBoolean()
    profilePublic?: boolean;

    @IsOptional()
    @IsBoolean()
    showListeningActivity?: boolean;

    // Audio/Playback
    @IsOptional()
    @IsBoolean()
    autoPlayEnabled?: boolean;

    @IsOptional()
    @IsNumber()
    @Min(0.5)
    @Max(2.0)
    playbackSpeed?: number;

    @IsOptional()
    @IsBoolean()
    downloadOverWifiOnly?: boolean;
}

export class UserSettingsResponseDto {
    theme: ThemePreference;
    pushNotificationsEnabled: boolean;
    emailNotificationsEnabled: boolean;
    marketingEmailsEnabled: boolean;
    profilePublic: boolean;
    showListeningActivity: boolean;
    autoPlayEnabled: boolean;
    playbackSpeed: number;
    downloadOverWifiOnly: boolean;
    termsAcceptedAt: Date | null;
    termsVersion: string | null;
    privacyPolicyAcceptedAt: Date | null;
    privacyPolicyVersion: string | null;
}
