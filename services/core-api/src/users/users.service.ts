import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../common/storage.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import {
    UpdateSettingsDto,
    UserSettingsResponseDto,
    ThemePreference,
} from './dto/user-settings.dto';
import { AcceptTermsDto } from './dto/accept-terms.dto';
import { UserProfileResponseDto } from './dto/user-profile.dto';

@Injectable()
export class UsersService {
    private readonly logger = new Logger(UsersService.name);

    constructor(
        private databaseService: DatabaseService,
        private storageService: StorageService,
    ) {}

    // ========== PROFILE ==========

    async getProfile(userId: string): Promise<UserProfileResponseDto> {
        this.logger.log(`getProfile() called for user ${userId}`);

        const user = await this.databaseService.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                dateOfBirth: true,
                isEmailVerified: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfileResponseDto> {
        this.logger.log(`updateProfile() called for user ${userId}`);

        // Build update data only with provided fields
        const updateData: any = {};
        if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
        if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
        if (dto.dateOfBirth !== undefined) updateData.dateOfBirth = new Date(dto.dateOfBirth);

        const user = await this.databaseService.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                dateOfBirth: true,
                isEmailVerified: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        this.logger.log(`Profile updated for user ${userId}`);
        return user;
    }

    // ========== LOGOUT ==========

    async logout(userId: string): Promise<{ message: string }> {
        this.logger.log(`logout() called for user ${userId}`);

        await this.databaseService.user.update({
            where: { id: userId },
            data: { refreshToken: null },
        });

        this.logger.log(`Refresh token cleared for user ${userId}`);
        return { message: 'Logged out successfully' };
    }

    // ========== DELETE ACCOUNT ==========

    async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<{ message: string }> {
        this.logger.log(`deleteAccount() called for user ${userId}`);

        // 1. Get user with password
        const user = await this.databaseService.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // 2. Verify password
        const isPasswordValid = await bcrypt.compare(dto.password, user.password);
        if (!isPasswordValid) {
            this.logger.warn(`Delete account failed: Invalid password for user ${userId}`);
            throw new ForbiddenException('Invalid password');
        }

        // 3. Delete user's files from storage
        await this.cleanupUserStorage(userId);

        // 4. Delete user (cascade handles books, podcasters, episodes, settings, subscription)
        await this.databaseService.user.delete({
            where: { id: userId },
        });

        this.logger.log(`Account deleted for user ${userId}`);
        return { message: 'Account deleted successfully' };
    }

    private async cleanupUserStorage(userId: string): Promise<void> {
        this.logger.log(`Cleaning up storage for user ${userId}`);

        // Get all books to delete their files
        const books = await this.databaseService.book.findMany({
            where: { userId },
            select: { fileStorageKey: true, fullTextKey: true, coverImageKey: true },
        });

        // Get all episodes to delete their audio files
        const episodes = await this.databaseService.episode.findMany({
            where: { userId },
            select: { audioFileKey: true },
        });

        // Delete book files
        for (const book of books) {
            if (book.fileStorageKey) {
                await this.storageService
                    .deleteFile(book.fileStorageKey)
                    .catch(e =>
                        this.logger.warn(`Failed to delete ${book.fileStorageKey}: ${e.message}`),
                    );
            }
            if (book.fullTextKey) {
                await this.storageService
                    .deleteFile(book.fullTextKey)
                    .catch(e =>
                        this.logger.warn(`Failed to delete ${book.fullTextKey}: ${e.message}`),
                    );
            }
            if (book.coverImageKey) {
                await this.storageService
                    .deleteFile(book.coverImageKey)
                    .catch(e =>
                        this.logger.warn(`Failed to delete ${book.coverImageKey}: ${e.message}`),
                    );
            }
        }

        // Delete episode audio files
        for (const episode of episodes) {
            if (episode.audioFileKey) {
                await this.storageService
                    .deleteFile(episode.audioFileKey)
                    .catch(e =>
                        this.logger.warn(`Failed to delete ${episode.audioFileKey}: ${e.message}`),
                    );
            }
        }

        this.logger.log(`Storage cleanup completed for user ${userId}`);
    }

    // ========== SETTINGS ==========

    async getSettings(userId: string): Promise<UserSettingsResponseDto> {
        this.logger.log(`getSettings() called for user ${userId}`);

        let settings = await this.databaseService.userSettings.findUnique({
            where: { userId },
        });

        // Create default settings if not exists
        if (!settings) {
            this.logger.log(`Creating default settings for user ${userId}`);
            settings = await this.databaseService.userSettings.create({
                data: { userId },
            });
        }

        return {
            theme: settings.theme as ThemePreference,
            pushNotificationsEnabled: settings.pushNotificationsEnabled,
            emailNotificationsEnabled: settings.emailNotificationsEnabled,
            marketingEmailsEnabled: settings.marketingEmailsEnabled,
            profilePublic: settings.profilePublic,
            showListeningActivity: settings.showListeningActivity,
            autoPlayEnabled: settings.autoPlayEnabled,
            playbackSpeed: settings.playbackSpeed,
            downloadOverWifiOnly: settings.downloadOverWifiOnly,
            termsAcceptedAt: settings.termsAcceptedAt,
            termsVersion: settings.termsVersion,
            privacyPolicyAcceptedAt: settings.privacyPolicyAcceptedAt,
            privacyPolicyVersion: settings.privacyPolicyVersion,
        };
    }

    async updateSettings(userId: string, dto: UpdateSettingsDto): Promise<UserSettingsResponseDto> {
        this.logger.log(`updateSettings() called for user ${userId}`);

        // Upsert settings
        await this.databaseService.userSettings.upsert({
            where: { userId },
            create: {
                userId,
                ...dto,
            },
            update: dto,
        });

        this.logger.log(`Settings updated for user ${userId}`);
        return this.getSettings(userId);
    }

    // ========== TERMS & CONDITIONS ==========

    async getTerms(): Promise<{ version: string; content: string; effectiveDate: Date }> {
        this.logger.log(`getTerms() called`);

        const terms = await this.databaseService.termsAndConditions.findFirst({
            where: { isActive: true },
            orderBy: { effectiveDate: 'desc' },
        });

        if (!terms) {
            // Return default if none exists in database
            return {
                version: '1.0',
                content: `Terms and Conditions for Auditure

1. Acceptance of Terms
By using Auditure, you agree to these Terms and Conditions.

2. User Accounts
You are responsible for maintaining the security of your account.

3. Content Usage
Books you upload are for personal use only. You must have rights to the content.

4. Generated Content
AI-generated podcast episodes are for personal, non-commercial use.

5. Privacy
We collect and process data as described in our Privacy Policy.

6. Termination
We reserve the right to terminate accounts that violate these terms.

7. Changes to Terms
We may update these terms. Continued use constitutes acceptance.

Last updated: January 2025`,
                effectiveDate: new Date('2025-01-01'),
            };
        }

        return {
            version: terms.version,
            content: terms.content,
            effectiveDate: terms.effectiveDate,
        };
    }

    async acceptTerms(userId: string, dto: AcceptTermsDto): Promise<{ message: string }> {
        this.logger.log(`acceptTerms() called for user ${userId}`);

        await this.databaseService.userSettings.upsert({
            where: { userId },
            create: {
                userId,
                termsAcceptedAt: new Date(),
                termsVersion: dto.termsVersion,
                privacyPolicyAcceptedAt: new Date(),
                privacyPolicyVersion: dto.privacyPolicyVersion,
            },
            update: {
                termsAcceptedAt: new Date(),
                termsVersion: dto.termsVersion,
                privacyPolicyAcceptedAt: new Date(),
                privacyPolicyVersion: dto.privacyPolicyVersion,
            },
        });

        this.logger.log(`Terms accepted for user ${userId}`);
        return { message: 'Terms and conditions accepted' };
    }

    // ========== SUBSCRIPTION ==========

    async getSubscription(userId: string) {
        this.logger.log(`getSubscription() called for user ${userId}`);

        let subscription = await this.databaseService.subscription.findUnique({
            where: { userId },
        });

        // Create default free subscription if not exists
        if (!subscription) {
            this.logger.log(`Creating default subscription for user ${userId}`);
            subscription = await this.databaseService.subscription.create({
                data: {
                    userId,
                    tier: 'FREE',
                    geminiEpisodeLimit: 1,
                    standardEpisodeLimit: 2,
                },
            });
        }

        // Check if usage period needs reset (monthly)
        const now = new Date();
        const periodStart = new Date(subscription.usagePeriodStart);
        const monthsSinceStart =
            (now.getFullYear() - periodStart.getFullYear()) * 12 +
            (now.getMonth() - periodStart.getMonth());

        if (monthsSinceStart >= 1) {
            this.logger.log(`Resetting usage counters for user ${userId}`);
            subscription = await this.databaseService.subscription.update({
                where: { userId },
                data: {
                    geminiEpisodesUsed: 0,
                    standardEpisodesUsed: 0,
                    usagePeriodStart: now,
                },
            });
        }

        const isPaid = subscription.tier === 'STARTER' || subscription.tier === 'PRO';

        return {
            tier: subscription.tier,
            isPaid,
            usage: {
                geminiEpisodes: {
                    used: subscription.geminiEpisodesUsed,
                    limit: subscription.geminiEpisodeLimit,
                    remaining: Math.max(
                        0,
                        subscription.geminiEpisodeLimit - subscription.geminiEpisodesUsed,
                    ),
                },
                standardEpisodes: {
                    used: subscription.standardEpisodesUsed,
                    limit: subscription.standardEpisodeLimit,
                    remaining: Math.max(
                        0,
                        subscription.standardEpisodeLimit - subscription.standardEpisodesUsed,
                    ),
                },
            },
            periodStart: subscription.usagePeriodStart,
            premiumExpiresAt: subscription.premiumExpiresAt,
        };
    }

    /**
     * Check if user has quota and consume it.
     * Used by EpisodesService before creating an episode.
     *
     * Free tier: separate limits (1 Gemini, 2 Standard)
     * Paid tiers: unified limit (20 Starter, 50 Pro - total across both types)
     *
     * @returns true if quota available (and consumed), false if exceeded
     */
    async checkAndConsumeQuota(userId: string, voiceTier: 'GEMINI' | 'STANDARD'): Promise<boolean> {
        const subscription = await this.getSubscription(userId);

        if (subscription.isPaid) {
            // Paid tiers use unified limit: total episodes across both types
            const totalUsed =
                subscription.usage.geminiEpisodes.used + subscription.usage.standardEpisodes.used;
            const totalLimit = subscription.usage.geminiEpisodes.limit; // Same as standard for paid
            if (totalUsed >= totalLimit) {
                this.logger.warn(`User ${userId} has exceeded unified episode quota (${totalUsed}/${totalLimit})`);
                return false;
            }
        } else {
            // Free tier: check individual limits (1 Gemini, 2 Standard)
            const usage =
                voiceTier === 'GEMINI'
                    ? subscription.usage.geminiEpisodes
                    : subscription.usage.standardEpisodes;

            if (usage.remaining <= 0) {
                this.logger.warn(`User ${userId} has exceeded ${voiceTier} quota`);
                return false;
            }
        }

        await this.incrementUsage(userId, voiceTier);
        return true;
    }

    private async incrementUsage(userId: string, voiceTier: 'GEMINI' | 'STANDARD'): Promise<void> {
        await this.databaseService.subscription.update({
            where: { userId },
            data:
                voiceTier === 'GEMINI'
                    ? { geminiEpisodesUsed: { increment: 1 } }
                    : { standardEpisodesUsed: { increment: 1 } },
        });
        this.logger.log(`Incremented ${voiceTier} usage for user ${userId}`);
    }
}
