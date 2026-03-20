import sgMail from "@sendgrid/mail";
import "dotenv/config";
import { buildVerificationEmailTemplate } from "./template/verification-email.template.js";

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

export interface SendGridService {
    sendEmail(to: string, subject: string, text: string, html: string): Promise<void>;
    sendVerificationEmailWithTemplate(to: string, token: string): Promise<void>;
}

 class SendGridServiceImpl implements SendGridService {
    private readonly fromEmail = getRequiredEnv("EMAIL_FROM");

    async sendEmail(to: string, subject: string, text: string, html: string): Promise<void> {
        const message = this.buildMessage(to, subject, text, html);
        await this.sendMessage(message, "Email sent");
    }

    async sendVerificationEmailWithTemplate(to: string, token: string): Promise<void> {
        const { text, html } = buildVerificationEmailTemplate(token);
        const message = this.buildMessage(to, "Verify your email", text, html);
        await this.sendMessage(message, "Verification email sent");
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
        const response = await sgMail.send(message);
        console.log(`${successPrefix}:`, response[0].statusCode);
    }
}

export const sendGridService: SendGridService = new SendGridServiceImpl();