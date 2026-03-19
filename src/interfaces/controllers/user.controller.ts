import { type Request, type Response, type NextFunction } from "express";
import {
    CreateUserConflictError,
    CreateUserValidationError,
    UserUseCase,
} from "../../usecases/users/users.usecases.js";
import { type UserEntity } from "../../domain/entities/user.entity.js";

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
            const password = this.getBodyString(req.body?.password);

            await this.userUseCase.createTemporaryUser({
                username: this.trimString(username),
                email: this.trimString(email),
                password: this.trimString(password),
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

    register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        await this.create(req, res, next);
    };

    updateAvatar = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = this.getBodyString(req.params?.id).trim();

            if (!id) {
                res.status(400).json({ message: "id is required" });
                return;
            }

            if (!req.file?.buffer?.length) {
                res.status(400).json({ message: "avatar file is required" });
                return;
            }

            const updatedUser = await this.userUseCase.updateUser(
                id,
                {},
                { buffer: req.file.buffer }
            );

            if (!updatedUser) {
                res.status(404).json({ message: "User not found" });
                return;
            }

            res.status(200).json({ data: this.toResponse(updatedUser) });
        } catch (error) {
            next(error);
        }
    };

    private getBodyString(value: unknown): string {
        return typeof value === "string" ? value : "";
    }
    private trimString(value: string): string {
        return value.trim();
    }

    private toResponse(user: UserEntity): Omit<UserEntity, "passwordHash"> {
        return {
            id: user.id,
            username: user.username,
            email: user.email,
            publicId: user.publicId,
            avatarUrl: user.avatarUrl,
            bio: user.bio,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }
}