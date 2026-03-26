import { type NextFunction, type Request, type Response } from "express";
import {
    PostUseCase,
    CreatePostValidationError,
} from "../../usecases/posts/post.usecase.js";
import { type AuthenticatedRequest } from "../middlewares/auth.middleware.js";

export class PostController {

    constructor(private readonly postUseCase: PostUseCase) { }

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

            if (content.trim() === "") {
                res.status(400).json({ message: "Content is required" });
                return;
            }
            const createdPost = await this.postUseCase.createPost({
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
    update = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const authUser = (req as AuthenticatedRequest).authUser;
            const postId = Array.isArray(req.params.postId)
                ? req.params.postId[0]
                : req.params.postId;
            if (!postId) {
                res.status(400).json({ message: "Post ID is required" });
                return;
            }
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            const content = this.getBodyString(req.body?.content);
            if (!content) {
                res.status(400).json({ message: "Content is required" });
                return;
            }

            const updatedPost = await this.postUseCase.updatePost(
                postId,
                content,
                authUser.userId,
            );
            res.status(200).json({ data: updatedPost });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };
    delete = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const authUser = (req as AuthenticatedRequest).authUser;
            const postId = Array.isArray(req.params.postId)
                ? req.params.postId[0]
                : req.params.postId;
            if (!postId) {
                res.status(400).json({ message: "Post ID is required" });
                return;
            }
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            await this.postUseCase.deletePost(postId, authUser.userId);
            res.status(200).json({ message: "Post deleted successfully" });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };

    getPostDetails = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const postId = Array.isArray(req.params.postId)
                ? req.params.postId[0]
                : req.params.postId;
            if (!postId) {
                res.status(400).json({ message: "Post ID is required" });
                return;
            }
            const postDetails = await this.postUseCase.findDetailedPostById(postId);
            if (!postDetails) {
                res.status(404).json({ message: "Post not found" });
                return;
            }
            res.status(200).json({ data: postDetails });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };

    displayUserPosts = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const authorId = this.getBodyString(req.params.userId).trim();
            if (!authorId) {
                res.status(400).json({ message: "User ID is required" });
                return;
            }

            const cursor = this.getQueryString(req.query?.cursor);
            const limit = this.getQueryNumber(req.query?.limit, 10);
            const sortBy = this.getSortBy(req.query?.sortBy);
            const sortOrder = this.getSortOrder(req.query?.sortOrder);

            const userPosts = await this.postUseCase.findManyPosts({
                authorId,
                cursor,
                limit,
                sortBy,
                sortOrder,
            });
            res.status(200).json({ data: userPosts });
        } catch (error) {
            if (error instanceof CreatePostValidationError) {
                res.status(400).json({ message: error.message });
                return;
            }
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };
    getLikesCommentCount = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const postId = Array.isArray(req.params.postId)
                ? req.params.postId[0]
                : req.params.postId;
            if (!postId) {
                res.status(400).json({ message: "Post ID is required" });
                return;
            }
            const likeCounts = await this.postUseCase.likeCountPost(postId);
            const commentCounts = await this.postUseCase.findCommentsCount(postId);
            res.status(200).json({ data: { likeCounts, commentCounts } });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };

    likeUnlikePost = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const authUser = (req as AuthenticatedRequest).authUser;
            const postId = Array.isArray(req.params.postId)
                ? req.params.postId[0]
                : req.params.postId;
            if (!postId) {
                res.status(400).json({ message: "Post ID is required" });
                return;
            }
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            const isLiked = await this.postUseCase.likeUnlikePost(
                postId,
                authUser.userId,
            );
            res.status(200).json({ data: { isLiked } });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };
    isPostLikedByAuthUser = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const authUser = (req as AuthenticatedRequest).authUser;
            const postId = Array.isArray(req.params.postId)
                ? req.params.postId[0]
                : req.params.postId;
            if (!postId) {
                res.status(400).json({ message: "Post ID is required" });
                return;
            }
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            const isLiked = await this.postUseCase.isPostLikedByUser(
                postId,
                authUser.userId,
            );
            res.status(200).json({ data: { isLiked } });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };

    commentOnPost = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const authUser = (req as AuthenticatedRequest).authUser;
            const postId = Array.isArray(req.params.postId)
                ? req.params.postId[0]
                : req.params.postId;
            if (!postId) {
                res.status(400).json({ message: "Post ID is required" });
                return;
            }
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            const content = this.getBodyString(req.body?.content);
            if (!content) {
                res.status(400).json({ message: "Content is required" });
                return;
            }
            const imageBuffer = this.getImageBuffers(req);
            const createdComment = await this.postUseCase.createComment({
                postId,
                userId: authUser.userId,
                content,
                imageBuffer,
            });
            res.status(201).json({ data: createdComment });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };

    getCommentsForPost = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const postId = Array.isArray(req.params.postId)
                ? req.params.postId[0]
                : req.params.postId;
            if (!postId) {
                res.status(400).json({ message: "Post ID is required" });
                return;
            }
            const cursor = this.getQueryString(req.query?.cursor);
            const limit = this.getQueryNumber(req.query?.limit, 10);
            const sortBy = this.getSortBy(req.query?.sortBy);
            const sortOrder = this.getSortOrder(req.query?.sortOrder);
            const comments = await this.postUseCase.displayCommentsFromPost({
                postId,
                cursor,
                limit,
                sortBy,
                sortOrder,
            });
            res.status(200).json({ data: comments });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };
    deleteComment = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const authUser = (req as AuthenticatedRequest).authUser;
            const commentId = Array.isArray(req.params.commentId)
                ? req.params.commentId[0]
                : req.params.commentId;
            if (!commentId) {
                res.status(400).json({ message: "Comment ID is required" });
                return;
            }
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            await this.postUseCase.deleteComment(commentId, authUser.userId);
            res.status(200).json({ message: "Comment deleted successfully" });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };

    private getBodyString(value: unknown): string {
        return typeof value === "string" ? value : "";
    }
    private getOptionalBodyString(value: unknown): string | undefined {
        const parsed = this.getBodyString(value).trim();
        return parsed || undefined;
    }

    private getQueryString(value: unknown): string | undefined {
        const parsed = this.getBodyString(value).trim();
        return parsed || undefined;
    }

    private getQueryNumber(value: unknown, defaultValue: number): number {
        const parsed = Number(this.getBodyString(value));
        if (!Number.isInteger(parsed) || parsed <= 0) {
            return defaultValue;
        }
        return parsed;
    }

    private getSortBy(value: unknown): "created_at" | "updated_at" | undefined {
        const parsed = this.getBodyString(value);
        if (parsed === "created_at" || parsed === "updated_at") {
            return parsed;
        }
        return undefined;
    }

    private getSortOrder(value: unknown): "asc" | "desc" | undefined {
        const parsed = this.getBodyString(value);
        if (parsed === "asc" || parsed === "desc") {
            return parsed;
        }
        return undefined;
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