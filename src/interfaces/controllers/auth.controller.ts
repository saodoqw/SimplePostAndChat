import { type NextFunction, type Request, type Response, type CookieOptions } from "express";
import {
    AuthInvalidCredentialsError,
    AuthUseCase,
    AuthValidationError,
} from "../../application/usecases/auth/auth.usecase.js";
import {
    CreateUserConflictError,
    CreateUserValidationError,
    UserUseCase,
} from "../../application/usecases/users/users.usecases.js";

const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";
const REFRESH_TOKEN_COOKIE_PATH = "/api/auth/refresh-token";

export class AuthController {

    constructor(
        private readonly userUseCase: UserUseCase,
        private readonly authUseCase: AuthUseCase,
    ) { }

    register = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const username = this.getBodyString(req.body?.username).trim();
            const email = this.getBodyString(req.body?.email).trim();
            const password = this.getBodyString(req.body?.password).trim();

            await this.userUseCase.createTemporaryUser({
                username,
                email,
                password,
            });

            res.status(201).json({ message: "Verification email sent" });
        } catch (error) {
            if (error instanceof CreateUserValidationError) {
                res.status(400).json({ message: error.message });
                return;
            }

            if (error instanceof CreateUserConflictError) {
                res.status(409).json({ message: error.message });
                return;
            }

            next(error);
        }
    };
    refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
            if (!refreshToken || refreshToken === "undefined") {
                res.status(400).json({ message: "Refresh token is required" });
                return;
            }
            const accessToken = await this.authUseCase.getAccessTokenFromRefreshToken(refreshToken);
            res.status(200).json({ accessToken });
        } catch (error) {
            if (error instanceof AuthValidationError) {
                res.status(400).json({ message: error.message });
                return;
            }
            next(error);
        }
    };

    logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // need match cookie created to ensure cookie is cleared in the browser
            res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
                path: REFRESH_TOKEN_COOKIE_PATH,
            });

            res.status(200).json({ message: "Logged out successfully" });
        } catch (error) {
            next(error);
        }
    };
    getCurrentUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                res.status(401).json({ message: "Authorization header missing or malformed" });
                return;
            }
            const token = authHeader.substring(7); // Remove "Bearer " prefix
            const userProfile = await this.authUseCase.getUserProfileFromAccessToken(token);
            res.status(200).json({ data: userProfile });
        } catch (error) {
            next(error);
        }
    };
    verifyRegistrationToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const token = this.getBodyString(req.params?.token).trim();
            const email = this.getBodyString(req.query?.email).trim();

            // console.log("[Verify Email] Request received:", {
            //     method: req.method,
            //     path: req.path,
            //     params: req.params,
            //     query: req.query,
            //     token: token ? `${token.slice(0, 10)}...` : "empty",
            //     email: email || "empty",
            // });

            if (!token || !email) {
                res.status(400).json({ message: "token and email are required" });
                return;
            }
            await this.userUseCase.verifyEmail(email, token);
            res.status(200).json({ message: "Email verified successfully" });
        } catch (error) {
            if (error instanceof CreateUserValidationError) {
                res.status(400).json({ message: error.message });
                return;
            }
            if (error instanceof CreateUserConflictError) {
                res.status(409).json({ message: error.message });
                return;
            }
            next(error);
        }
    };
    login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const email = this.getBodyString(req.body?.email);
            const password = this.getBodyString(req.body?.password);

            const loginResult = await this.authUseCase.login({
                email,
                password,
            });
            // Set refresh token in HttpOnly cookie
            const cookieOptions: CookieOptions = {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                // Ensure the cookie is only sent to the refresh token endpoint
                path: REFRESH_TOKEN_COOKIE_PATH,
            };
            res.cookie(REFRESH_TOKEN_COOKIE_NAME, loginResult.refreshToken, cookieOptions);
            const responseData = {
                accessToken: loginResult.accessToken,
                user: loginResult.user,
            };
            res.status(200).json({ data: responseData });
        } catch (error) {
            if (error instanceof AuthValidationError) {
                res.status(400).json({ message: error.message });
                return;
            }

            if (error instanceof AuthInvalidCredentialsError) {
                res.status(401).json({ message: error.message });
                return;
            }

            next(error);
        }
    };

    requestRefreshPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const email = this.getBodyString(req.query?.email);
            if (!email) {
                res.status(400).json({ message: "email is required" });
                return;
            }
            await this.userUseCase.requestPasswordReset(email);
            res.status(200).json({ message: "Password reset email sent" });

        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };
    verifyPasswordResetToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const token = this.getBodyString(req.params?.token).trim();
            const email = this.getBodyString(req.query?.email).trim();
            const newPassword = this.getBodyString(req.body?.newPassword).trim();
            if (!token || !email || !newPassword) {
                res.status(400).json({ message: "token, email, and new password are required" });
                return;
            }
            await this.userUseCase.resetPassword(email, token, newPassword);
            res.status(200).json({ message: "Password reset successfully" });
        } catch (error) {
            if (error instanceof CreateUserValidationError) {
                res.status(400).json({ message: error.message });
                return;
            }
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };


    private getBodyString(value: unknown): string {
        return typeof value === "string" ? value : "";
    }

}