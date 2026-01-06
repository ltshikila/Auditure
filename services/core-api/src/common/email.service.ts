import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
    private transporter: nodemailer.Transporter;
    private readonly logger = new Logger(EmailService.name);
    private readonly isDevelopment = process.env.NODE_ENV !== 'production';

    constructor() {
        // In development, use a test account or log emails
        if (this.isDevelopment) {
            this.logger.warn('Running in development mode - emails will be logged instead of sent');
            // Create a fake transporter for development
            this.transporter = nodemailer.createTransport({
                streamTransport: true,
                newline: 'unix',
            } as any);
        } else {
            this.transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST,
                port: parseInt(process.env.EMAIL_PORT || '587'),
                secure: false,
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASSWORD,
                },
            });
        }
    }

    async sendOTP(email: string, otp: string): Promise<void> {
        const mailOptions = {
            from: process.env.EMAIL_FROM || 'Narratica <noreply@narratica.io>',
            to: email,
            subject: 'Your Narratica Verification Code',
            html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .otp-code { background-color: #fff; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4F46E5; margin: 20px 0; border: 2px dashed #4F46E5; border-radius: 5px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Narratica Verification</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>Thank you for signing up with Narratica! To complete your registration, please use the verification code below:</p>
              <div class="otp-code">${otp}</div>
              <p>This code will expire in ${process.env.OTP_EXPIRY_MINUTES || '10'} minutes.</p>
              <p>If you didn't request this code, please ignore this email.</p>
              <p>Best regards,<br>The Narratica Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
        };

        try {
            if (this.isDevelopment) {
                // In development, just log the OTP
                this.logger.log(`📧 [DEV] Email would be sent to: ${email}`);
                this.logger.log(`🔑 [DEV] Verification Code: ${otp}`);
                this.logger.log(`⏰ [DEV] Expires in: ${process.env.OTP_EXPIRY_MINUTES || '10'} minutes`);
            } else {
                await this.transporter.sendMail(mailOptions);
                this.logger.log(`✅ Verification email sent to: ${email}`);
            }
        } catch (error) {
            this.logger.error('Error sending OTP email:', error);
            // Don't throw error in development, just log it
            if (!this.isDevelopment) {
                throw new Error('Unable to send verification email. Please try again later.');
            }
        }
    }
}
