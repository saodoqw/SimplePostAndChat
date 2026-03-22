import { type NextFunction, type Request, type Response } from "express";
import {
    AuthInvalidCredentialsError,
    AuthUseCase,
    AuthValidationError,
} from "../../usecases/auth/auth.usecase.js";
import {
    CreateUserConflictError,
    CreateUserValidationError,
    UserUseCase,
} from "../../usecases/users/users.usecases.js";

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
    verifyRegistrationToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const token = this.getBodyString(req.params?.id).trim();
            const email = this.getBodyString(req.query?.email).trim();

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
    login = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const email = this.getBodyString(req.body?.email);
            const password = this.getBodyString(req.body?.password);

            const loginResult = await this.authUseCase.login({
                email,
                password,
            });

            res.status(200).json({ data: loginResult });
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
            const token = this.getBodyString(req.params?.id).trim();
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