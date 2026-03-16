import { type Request, type Response, type NextFunction } from "express";
import {
    CreateUserConflictError,
    CreateUserValidationError,
    UserUseCase,
} from "../../usecases/users/users.usecases.js";

export class UserController {
    constructor(private readonly userUseCase: UserUseCase) { }

    create = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const username = this.getBodyString(req.body?.username);
            const email = this.getBodyString(req.body?.email);
            const passwordHash = this.getBodyString(req.body?.passwordHash);

            const createdUser = await this.userUseCase.createUser({
                username: this.trimString(username),
                email: this.trimString(email),
                passwordHash: this.trimString(passwordHash),
            });

            res.status(201).json({ data: createdUser });
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

    register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        await this.create(req, res, next);
    };

    private getBodyString(value: unknown): string {
        return typeof value === "string" ? value : "";
    }
    private trimString(value: string): string {
        return value.trim();
    }
}