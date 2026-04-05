import sgMail from "@sendgrid/mail";
import "dotenv/config";
import { buildVerificationEmailTemplate } from "./template/verification-email.template.js";
import { buildPasswordResetEmailTemplate } from "./template/reset-password.template.js";
import { type EmailService } from "../../application/ports/email.service.js";

type SendGridMessage = {
    to: string;
    from: string;
    subject: string;
    text: string;
    html: string;
};

function getRequiredEnv(variableName: string): string {
    const value = process.env[variableName];

    if (!value) {
        throw new Error(`${variableName} is missing in .env`);
    }

    return value;
}

const apiKey = getRequiredEnv("SENDGRID_API_KEY");

sgMail.setApiKey(apiKey);

 class SendGridServiceImpl implements EmailService {
    private readonly fromEmail = getRequiredEnv("EMAIL_FROM");

    async sendEmail(to: string, subject: string, text: string, html: string): Promise<void> {
        const message = this.buildMessage(to, subject, text, html);
        await this.sendMessage(message, "Email sent");
    }

    async sendVerificationEmailWithTemplate(to: string, token: string): Promise<void> {
        const { text, html } = buildVerificationEmailTemplate(token, to);
        const message = this.buildMessage(to, "Verify your email", text, html);
        await this.sendMessage(message, "Verification email sent");
    }

    async sendPasswordResetEmailWithTemplate(to: string, token: string): Promise<void> {
        const { text, html } = buildPasswordResetEmailTemplate(token, to);
        const message = this.buildMessage(to, "Reset your password", text, html);
        await this.sendMessage(message, "Password reset email sent");
    }

    // Helper method to build the email message
    private buildMessage(
        to: string,
        subject: string,
        text: string,
        html: string,
    ): SendGridMessage {
        return {
            to,
            from: this.fromEmail,
            subject,
            text,
            html,
        };
    }
    // Helper method to send email and log the result
    private async sendMessage(message: SendGridMessage, successPrefix: string): Promise<void> {
        try {
            console.log(`[SendGrid] Attempting to send email to: ${message.to}`);
            console.log(`[SendGrid] From: ${message.from}`);
            console.log(`[SendGrid] Subject: ${message.subject}`);
            
            const response = await sgMail.send(message);
            
            console.log(`[SendGrid] ${successPrefix}:`, {
                statusCode: response[0].statusCode,
                headers: response[0].headers,
                to: message.to,
            });
        } catch (error) {
            console.error(`[SendGrid] Failed to send email to ${message.to}:`, {
                error: error instanceof Error ? error.message : String(error),
                errorBody: error instanceof Error && error.message.includes("error") ? error : null,
                timestamp: new Date().toISOString(),
            });
            throw new Error(`Failed to send email to ${message.to}. Check server logs for details.`);
        }
    }
}

export const sendGridService: EmailService = new SendGridServiceImpl();