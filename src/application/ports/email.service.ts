export interface EmailService {
    sendEmail(to: string, subject: string, text: string, html: string): Promise<void>;
    sendVerificationEmailWithTemplate(to: string, token: string): Promise<void>;
    sendPasswordResetEmailWithTemplate(to: string, token: string): Promise<void>;
}
