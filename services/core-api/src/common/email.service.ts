import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
    private resend: Resend;
    private readonly logger = new Logger(EmailService.name);
    private readonly isDevelopment = process.env.NODE_ENV !== 'production';

    constructor() {
        const apiKey = process.env.RESEND_API_KEY;

        if (!apiKey && !this.isDevelopment) {
            this.logger.error('RESEND_API_KEY is not configured');
        }

        this.resend = new Resend(apiKey);
    }

    async sendOTP(email: string, otp: string): Promise<void> {
        const from = process.env.EMAIL_FROM || 'Auditure <noreply@auditure.app>';
        const expiryMinutes = process.env.OTP_EXPIRY_MINUTES || '10';

        const logoUrl = process.env.EMAIL_LOGO_URL || '';
        const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="Auditure" width="60" height="60" style="margin-bottom: 10px;" />` : '';

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #920002; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #FBF8F2; padding: 30px; border-radius: 0 0 5px 5px; }
            .otp-code { background-color: #fff; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #920002; margin: 20px 0; border: 2px dashed #BF9A54; border-radius: 5px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              ${logoHtml}
              <h1>Auditure Verification</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>Thank you for signing up with Auditure! To complete your registration, please use the verification code below:</p>
              <div class="otp-code">${otp}</div>
              <p>This code will expire in ${expiryMinutes} minutes.</p>
              <p>If you didn't request this code, please ignore this email.</p>
              <p>Best regards,<br>The Auditure Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

        try {
            if (this.isDevelopment) {
                this.logger.log(`📧 [DEV] Email would be sent to: ${email}`);
                this.logger.log(`🔑 [DEV] Verification Code: ${otp}`);
                this.logger.log(`⏰ [DEV] Expires in: ${expiryMinutes} minutes`);
                return;
            }

            const { data, error } = await this.resend.emails.send({
                from,
                to: email,
                subject: 'Your Auditure Verification Code',
                html: htmlContent,
            });

            if (error) {
                this.logger.error('Resend API error:', error);
                throw new Error('Unable to send verification email. Please try again later.');
            }

            this.logger.log(`✅ Verification email sent to: ${email} (id: ${data?.id})`);
        } catch (error) {
            this.logger.error('Error sending OTP email:', error);
            if (!this.isDevelopment) {
                throw new Error('Unable to send verification email. Please try again later.');
            }
        }
    }

    async sendPasswordResetOTP(email: string, otp: string): Promise<void> {
        const from = process.env.EMAIL_FROM || 'Auditure <noreply@auditure.app>';
        const expiryMinutes = process.env.OTP_EXPIRY_MINUTES || '10';
        const logoUrl = process.env.EMAIL_LOGO_URL || '';
        const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="Auditure" width="60" height="60" style="margin-bottom: 10px;" />` : '';

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #920002; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #FBF8F2; padding: 30px; border-radius: 0 0 5px 5px; }
            .otp-code { background-color: #fff; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #920002; margin: 20px 0; border: 2px dashed #BF9A54; border-radius: 5px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              ${logoHtml}
              <h1>Reset Your Password</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>We received a request to reset your Auditure password. Use the code below to set a new password:</p>
              <div class="otp-code">${otp}</div>
              <p>This code will expire in ${expiryMinutes} minutes.</p>
              <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
              <p>Best regards,<br>The Auditure Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

        try {
            if (this.isDevelopment) {
                this.logger.log(`📧 [DEV] Password reset email would be sent to: ${email}`);
                this.logger.log(`🔑 [DEV] Reset Code: ${otp}`);
                this.logger.log(`⏰ [DEV] Expires in: ${expiryMinutes} minutes`);
                return;
            }

            const { data, error } = await this.resend.emails.send({
                from,
                to: email,
                subject: 'Reset Your Auditure Password',
                html: htmlContent,
            });

            if (error) {
                this.logger.error('Resend API error:', error);
                throw new Error('Unable to send password reset email. Please try again later.');
            }

            this.logger.log(`✅ Password reset email sent to: ${email} (id: ${data?.id})`);
        } catch (error) {
            this.logger.error('Error sending password reset email:', error);
            if (!this.isDevelopment) {
                throw new Error('Unable to send password reset email. Please try again later.');
            }
        }
    }
}
