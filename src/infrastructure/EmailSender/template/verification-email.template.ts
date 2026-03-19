function escapeHtml(value: string): string {
		return value
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/\"/g, "&quot;")
				.replace(/'/g, "&#39;");
}

function buildVerificationUrl(token: string): string {
		const frontendUrl = process.env.FRONTEND_URL;

		if (!frontendUrl) {
				throw new Error("FRONTEND_URL is missing in .env");
		}

		const normalizedToken = token.trim();

		if (!normalizedToken) {
				throw new Error("Verification token is required");
		}

		const url = new URL("/verify-email", frontendUrl);
		url.searchParams.set("token", normalizedToken);

		return url.toString();
}

export function buildVerificationEmailTemplate(token: string): {
		text: string;
		html: string;
} {
		const verificationUrl = buildVerificationUrl(token);
		const escapedUrl = escapeHtml(verificationUrl);

		const text = [
				"Welcome to Simple Post and Chat!",
				"Please verify your email by opening the link below:",
				verificationUrl,
				"",
				"If you did not create this account, you can safely ignore this email.",
		].join("\n");

		const html = `
<!doctype html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>Email Verification</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f8fb; font-family: Arial, sans-serif; color: #1f2937;">
	<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="padding: 24px 12px;">
		<tr>
			<td align="center">
				<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;">
					<tr>
						<td style="padding: 28px 24px 16px;">
							<h1 style="margin: 0 0 12px; font-size: 22px; line-height: 1.3; color: #111827;">Verify your email</h1>
							<p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #374151;">
								Thanks for signing up. Click the button below to verify your email address.
							</p>
							<a
								href="${escapedUrl}"
								style="display: inline-block; background-color: #0f766e; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 8px; font-size: 14px; font-weight: 600;"
							>
								Verify Email
							</a>
							<p style="margin: 20px 0 0; font-size: 13px; line-height: 1.6; color: #6b7280; word-break: break-all;">
								If the button does not work, copy and paste this URL into your browser:<br />
								<a href="${escapedUrl}" style="color: #0f766e;">${escapedUrl}</a>
							</p>
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>
`.trim();

		return { text, html };
}
