import sgMail from "@sendgrid/mail";
import "dotenv/config";
import { buildVerificationEmailTemplate } from "./template/verification-email.template.js";

const apiKey = process.env.SENDGRID_API_KEY;

if (!apiKey) {
    console.log("API KEY:", process.env.SENDGRID_API_KEY);
    throw new Error("SENDGRID_API_KEY is missing in .env");
}

sgMail.setApiKey(apiKey);

export interface SendGridService {
    sendEmail(to: string, subject: string, text: string, html: string): Promise<void>;
    sendVerificationEmailWithTemplate(to: string, token: string): Promise<void>;
}

export class SendGridServiceImpl implements SendGridService {
    async sendEmail(to: string, subject: string, text: string, html: string): Promise<void> {
        const msg = {
            to,
            from: process.env.EMAIL_FROM as string,
            subject,
            text,
            html,
        };

        const response = await sgMail.send(msg);

        console.log("Email sent:", response[0].statusCode);
    }
    async sendVerificationEmailWithTemplate(to: string, token: string): Promise<void> {
        const { text, html } = buildVerificationEmailTemplate(token);

        const msg = {
            to,
            from: process.env.EMAIL_FROM as string,
            subject: "Verify your email",
            text,
            html,

        };
        const response = await sgMail.send(msg);
        console.log("Verification email sent:", response[0].statusCode);
    }
}

export const sendGridService: SendGridService = new SendGridServiceImpl();