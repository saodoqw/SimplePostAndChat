import sgMail from "@sendgrid/mail";
import "dotenv/config";

const apiKey = process.env.SENDGRID_API_KEY;

if (!apiKey) {
    console.log("API KEY:", process.env.SENDGRID_API_KEY);
    throw new Error("SENDGRID_API_KEY is missing in .env");
}

sgMail.setApiKey(apiKey);

export class SendGridService {
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
}

async function testEmail() {
    const emailService = new SendGridService();

    try {
        await emailService.sendEmail(
            "saodoqw@gmail.com",
            "Test Email",
            "This is a test email from SendGridService",
            "<p>This is a test email from <strong>SendGridService</strong></p>"
        );
    } catch (error) {
        console.error("Error sending email:", error);
    }
}

testEmail();