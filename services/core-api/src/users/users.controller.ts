import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    Request,
    HttpCode,
    HttpStatus,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UpdateSettingsDto } from './dto/user-settings.dto';
import { AcceptTermsDto } from './dto/accept-terms.dto';
import { hasValidSignature } from '../common/file-validation';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    // ========== PROFILE ==========

    /**
     * Get current user profile
     * GET /users/me
     */
    @Get('me')
    getProfile(@Request() req) {
        return this.usersService.getProfile(req.user.userId);
    }

    /**
     * Update current user profile
     * PATCH /users/me
     */
    @Patch('me')
    updateProfile(@Request() req, @Body() updateProfileDto: UpdateProfileDto) {
        return this.usersService.updateProfile(req.user.userId, updateProfileDto);
    }

    /**
     * Upload profile picture
     * POST /users/me/profile-picture
     */
    @Post('me/profile-picture')
    @UseInterceptors(
        FileInterceptor('file', {
            limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
            fileFilter: (req, file, cb) => {
                if (!file.mimetype.match(/^image\/(jpeg|png|webp|gif)$/)) {
                    return cb(
                        new BadRequestException(
                            'Only image files (JPEG, PNG, WebP, GIF) are allowed',
                        ),
                        false,
                    );
                }
                cb(null, true);
            },
        }),
    )
    uploadProfilePicture(@Request() req, @UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('No file provided');
        }
        if (!hasValidSignature(file.buffer, 'image')) {
            throw new BadRequestException('File contents are not a valid image');
        }
        return this.usersService.uploadProfilePicture(req.user.userId, file);
    }

    /**
     * Remove profile picture
     * DELETE /users/me/profile-picture
     */
    @Delete('me/profile-picture')
    @HttpCode(HttpStatus.OK)
    removeProfilePicture(@Request() req) {
        return this.usersService.removeProfilePicture(req.user.userId);
    }

    /**
     * Delete current user account (requires password confirmation)
     * DELETE /users/me
     */
    @Delete('me')
    @HttpCode(HttpStatus.OK)
    deleteAccount(@Request() req, @Body() deleteAccountDto: DeleteAccountDto) {
        return this.usersService.deleteAccount(req.user.userId, deleteAccountDto);
    }

    // ========== LOGOUT ==========

    /**
     * Logout (clear refresh token)
     * POST /users/logout
     */
    @Post('logout')
    @HttpCode(HttpStatus.OK)
    logout(@Request() req) {
        return this.usersService.logout(req.user.userId);
    }

    // ========== SETTINGS ==========

    /**
     * Get user settings
     * GET /users/settings
     */
    @Get('settings')
    getSettings(@Request() req) {
        return this.usersService.getSettings(req.user.userId);
    }

    /**
     * Update user settings
     * PATCH /users/settings
     */
    @Patch('settings')
    updateSettings(@Request() req, @Body() updateSettingsDto: UpdateSettingsDto) {
        return this.usersService.updateSettings(req.user.userId, updateSettingsDto);
    }

    // ========== SUBSCRIPTION ==========

    /**
     * Get subscription status and usage
     * GET /users/subscription
     */
    @Get('subscription')
    getSubscription(@Request() req) {
        return this.usersService.getSubscription(req.user.userId);
    }

    // ========== TERMS & CONDITIONS ==========

    /**
     * Get current terms and conditions
     * GET /users/terms
     */
    @Get('terms')
    getTerms() {
        return this.usersService.getTerms();
    }

    /**
     * Accept terms and conditions
     * POST /users/terms/accept
     */
    @Post('terms/accept')
    @HttpCode(HttpStatus.OK)
    acceptTerms(@Request() req, @Body() acceptTermsDto: AcceptTermsDto) {
        return this.usersService.acceptTerms(req.user.userId, acceptTermsDto);
    }
}
