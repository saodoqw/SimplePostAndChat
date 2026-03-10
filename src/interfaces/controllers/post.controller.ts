import { type NextFunction, type Request, type Response } from "express";
import {
    CreatePostUseCase,
    CreatePostValidationError,
} from "../../usecases/posts/create-post.usecase.js";

export class PostController {
    constructor(private readonly createPostUseCase: CreatePostUseCase) {}

    create = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const authorId = this.getBodyString(req.body?.authorId);
            const content = this.getBodyString(req.body?.content);

            const createdPost = await this.createPostUseCase.execute({
                authorId,
                content,
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
}