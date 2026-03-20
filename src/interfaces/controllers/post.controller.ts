import { type NextFunction, type Request, type Response } from "express";
import {
    CreatePostUseCase,
    CreatePostValidationError,
} from "../../usecases/posts/post.usecase.js";
import { type AuthenticatedRequest } from "../middlewares/auth.middleware.js";

export class PostController {
    constructor(private readonly createPostUseCase: CreatePostUseCase) {}

    create = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const authUser = (req as AuthenticatedRequest).authUser;
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }

            const content = this.getBodyString(req.body?.content);
            const imageBuffer = this.getImageBuffers(req);

            const createdPost = await this.createPostUseCase.createPost({
                authorId: authUser.userId,
                content,
                imageBuffer,
            });

            res.status(201).json({ data: createdPost });
        } catch (error) {
            if (error instanceof CreatePostValidationError) {
                res.status(400).json({ message: error.message });
                return;
            }

            next(error);
        }
    };


    private getBodyString(value: unknown): string {
        return typeof value === "string" ? value : "";
    }

    private getImageBuffers(req: Request): Buffer[] | undefined {
        if (!req.files) {
            return undefined;
        }

        if (Array.isArray(req.files)) {
            const buffers = req.files
                .map((file) => file.buffer)
                .filter((buffer) => buffer.length > 0);
            return buffers.length ? buffers : undefined;
        }

        const imageFiles = req.files.images;
        if (!Array.isArray(imageFiles)) {
            return undefined;
        }

        const buffers = imageFiles
            .map((file) => file.buffer)
            .filter((buffer) => buffer.length > 0);

        return buffers.length ? buffers : undefined;
    }
}