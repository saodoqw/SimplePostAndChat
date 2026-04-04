import {
    PostEntityValidationError,
} from "../../domain/entities/post.entity.js";
import {
    type CreatePostCommentRepositoryInput,
    type FindPostComment,
    type PostRepository,
} from "../../domain/repositories/post.repository.js";
import { type CloudinaryService } from '../../infrastructure/imageStorage/cloudinary/cloudinary.service.js';

export interface CreatePostUseCaseInput {
    authorId: string;
    content: string;
}
export interface CreatePostUseCaseInputWithImage extends CreatePostUseCaseInput {
    imageBuffer?: Buffer[];
}
export interface imageArray {
    url: string;
    publicId: string;
}
export interface createPostWithMediaOutput {
    id: string;
    authorId: string;
    content: string;
    imageUrls?: string[];
    createdAt: Date;
}
export interface postDetails {
    postId: string;
    authorId: string;
    content: string;
    imageUrls?: string[];
    createdAt: Date;
    likeCount: number;
    commentsCount: number;
    isLikedByAuthUser: boolean;
}
interface updatePostOutput {
    postId: string;
    authorId: string;
    content: string;
    imageUrls?: string[];
    createdAt: Date;
}
export interface findUserPostsInput {
    authorId: string;
    authUserId?: string;
    cursor?: string;
    limit: number;
    sortBy?: "created_at" | "updated_at";
    sortOrder?: "asc" | "desc";
}
export interface postCommentDetails {
    commentId: string;
    userId: string;
    content: string;
    imageUrls?: string[];
    createdAt: Date;
}
export interface createCommentInput extends CreatePostCommentRepositoryInput {
    imageBuffer?: Buffer[];
}
export interface postCommentsResult {
    postId: string;
    nextCursor?: string;
    comments: postCommentDetails[];
}


export interface UserPostsResult {
    authorId: string;
    nextCursor?: string;
    posts: postDetails[];
}
export class CreatePostValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CreatePostValidationError";
    }
}

export class PostUseCase {
    constructor(
        private readonly postRepository: PostRepository,
        private readonly cloudinaryService: CloudinaryService,
    ) { }

    async createPost(input: CreatePostUseCaseInputWithImage): Promise<createPostWithMediaOutput> {
        const authorId = input.authorId?.trim();
        const content = input.content?.trim();

        if (!authorId) {
            throw new CreatePostValidationError("authorId is required");
        }
        if (!content) {
            throw new CreatePostValidationError("content is required");
        }

        try {
            // If no images are provided, create a post without media
            if (!input.imageBuffer?.length) {
                const CreatedPost = await this.postRepository.create({
                    authorId,
                    content,
                });
                return {
                    id: CreatedPost.id,
                    authorId: CreatedPost.author_id,
                    content: CreatedPost.content,
                    createdAt: CreatedPost.created_at,
                };
            }
            // If images are provided, upload them and create a post with media
            const uploadedImages = await this.uploadImages(input.imageBuffer);
            const imageUrls = uploadedImages.map((image) => ({
                url: image.url,
                publicId: image.publicId,
            }));

            const CreatedPost = await this.postRepository.createPostWithMedia({
                authorId,
                content,
                media: imageUrls.map((image) => ({
                    mediaUrl: image.url,
                    mediaType: "image",
                    publicId: image.publicId,
                })),
            });

            return {
                id: CreatedPost.post.id,
                authorId: CreatedPost.post.author_id,
                content: CreatedPost.post.content,
                imageUrls: imageUrls.map((image) => image.url),
                createdAt: CreatedPost.post.created_at,
            };
        } catch (error) {
            if (error instanceof PostEntityValidationError) {
                throw new CreatePostValidationError(error.message);
            }
            throw error;
        }
    }

    async updatePost(postId: string, content: string, userId: string): Promise<updatePostOutput> {
        const existingPost = await this.postRepository.findById(postId);
        if (!existingPost) {
            throw new Error("Post not found");
        }
        if (existingPost.post.author_id !== userId) {
            throw new Error("Unauthorized: You can only update your own posts");
        }

        await this.postRepository.updateById(postId, { content });
        const displayedPost = await this.postRepository.findById(postId);

        return {
            postId: displayedPost!.post.id,
            authorId: displayedPost!.post.author_id,
            content: displayedPost!.post.content,
            imageUrls: displayedPost!.media?.filter(m => m.mediaType === "image").map(m => m.mediaUrl) || [],
            createdAt: displayedPost!.post.created_at,
        };
    }

    async deletePost(postId: string, userId: string): Promise<void> {
        const existingPost = await this.postRepository.findById(postId);
        if (!existingPost) {
            throw new Error("Post not found");
        }
        if (existingPost.post.author_id !== userId) {
            throw new Error("Unauthorized: You can only delete your own posts");
        }
        try {
            await Promise.all(existingPost.media.map(async (media) => {
                if (media.publicId) {
                    await this.cloudinaryService.deleteImage(media.publicId);
                }
            }));
        }
        catch (error) {
            console.error("Failed to delete post media from Cloudinary:", error);
        }
        await this.postRepository.deleteById(postId);
    }

    async findDetailedPostById(postId: string, userId: string): Promise<postDetails> {
        const existingPost = await this.postRepository.findById(postId);
        if (!existingPost) {
            throw new Error("Post not found");
        }
        const [likeCount, commentsCount] = await Promise.all([
            this.postRepository.findLikesCount(postId),
            this.postRepository.findCommentCount(postId),
        ]);
        const isLikedByAuthUser = userId
            ? await this.postRepository.isPostLikedByUser(postId, userId)
            : false;

        return {
            postId: existingPost.post.id,
            authorId: existingPost.post.author_id,
            content: existingPost.post.content,
            imageUrls: existingPost.media?.filter((m) => m.mediaType === "image").map((m) => m.mediaUrl) ?? [],
            createdAt: existingPost.post.created_at,
            likeCount,
            commentsCount,
            isLikedByAuthUser,
        };
    }
    //Find posts by authorId with pagination and sorting
    async findManyPosts(query: findUserPostsInput): Promise<UserPostsResult> {
        const authorId = query.authorId?.trim();
        const authUserId = query.authUserId?.trim();
        const cursor = query.cursor?.trim() || undefined;
        const limit = Number(query.limit);

        if (!authorId) {
            throw new CreatePostValidationError("authorId is required");
        }
        if (!Number.isInteger(limit) || limit <= 0) {
            throw new CreatePostValidationError("limit must be a positive integer");
        }

        const result = await this.postRepository.findManyPosts({
            authorId,
            authUserId,
            cursor,
            limit,
            sortBy: query.sortBy ?? "created_at",
            sortOrder: query.sortOrder ?? "desc",
        });

        const posts = (result.data ?? []).map((post) => ({
            postId: post.post.id,
            authorId: post.post.author_id,
            content: post.post.content,
            imageUrls: post.media?.filter((m) => m.mediaType === "image").map((m) => m.mediaUrl) ?? [],
            createdAt: post.post.created_at,
            likeCount: post.likeCount ?? 0,
            commentsCount: post.commentsCount ?? 0,
            isLikedByAuthUser: post.isLikedByAuthUser,
        }));

        return {
            authorId,
            nextCursor: result.nextCursor,
            posts,
        };
    }
    // Like a post, if the user has already liked it, then unlike it
    async likeCountPost(postId: string): Promise<number> {
        const existingPost = await this.postRepository.findById(postId);
        if (!existingPost) {
            throw new Error("Post not found");
        }
        return await this.postRepository.findLikesCount(postId);
    }

    async likeUnlikePost(postId: string, userId: string): Promise<boolean> {
        const existingPost = await this.postRepository.findById(postId);
        if (!existingPost) {
            throw new Error("Post not found");
        }
        const hasLiked = await this.postRepository.isPostLikedByUser(postId, userId);
        if (hasLiked) {
            await this.postRepository.unlikePost(postId, userId);
        }
        else {
            await this.postRepository.likePost(postId, userId);
        }
        return !hasLiked;
    }

    async isPostLikedByUser(postId: string, userId: string): Promise<boolean> {
        const existingPost = await this.postRepository.findById(postId);
        if (!existingPost) {
            throw new Error("Post not found");
        }
        return await this.postRepository.isPostLikedByUser(postId, userId);
    }
    async findCommentsCount(postId: string): Promise<number> {
        const existingPost = await this.postRepository.findById(postId);
        if (!existingPost) {
            throw new Error("Post not found");
        }
        const result = await this.postRepository.findCommentCount(postId);
        return result;
    }

    // Create a comment for a post, if imageBuffer is provided, upload the image and create a comment with media
    async createComment(data: createCommentInput): Promise<postCommentDetails> {
        const postId = data.postId?.trim();
        const userId = data.userId?.trim();
        const content = data.content?.trim();

        if (!postId) {
            throw new CreatePostValidationError("postId is required");
        }
        if (!userId) {
            throw new CreatePostValidationError("userId is required");
        }
        if (!content) {
            throw new CreatePostValidationError("content is required");
        }

        const existingPost = await this.postRepository.findById(postId);
        if (!existingPost) {
            throw new Error("Post not found");
        }

        if (!data.imageBuffer?.length) {
            const createdComment = await this.postRepository.createComment({
                postId,
                userId,
                content,
            });

            return {
                commentId: createdComment.id,
                userId: createdComment.userId,
                content: createdComment.content,
                imageUrls: [],
                createdAt: createdComment.createdAt,
            };
        }

        const uploadedImages = await this.uploadCommentImages(data.imageBuffer);
        const createdComment = await this.postRepository.createCommentWithMedia({
            postId,
            userId,
            content,
            media: uploadedImages.map((image) => ({
                mediaUrl: image.url,
                mediaType: "image",
                publicId: image.publicId,
            })),
        });

        return {
            commentId: createdComment.comment.id,
            userId: createdComment.comment.userId,
            content: createdComment.comment.content,
            imageUrls: createdComment.media?.filter((m) => m.mediaType === "image").map((m) => m.mediaUrl) ?? [],
            createdAt: createdComment.comment.createdAt,
        };
    }

    async displayCommentsFromPost(query: FindPostComment): Promise<postCommentsResult> {
        const postId = query.postId?.trim();
        const cursor = query.cursor?.trim() || undefined;
        const limit = Number(query.limit);

        if (!postId) {
            throw new CreatePostValidationError("postId is required");
        }
        if (!Number.isInteger(limit) || limit <= 0) {
            throw new CreatePostValidationError("limit must be a positive integer");
        }

        const existingPost = await this.postRepository.findById(postId);
        if (!existingPost) {
            throw new Error("Post not found");
        }

        const result = await this.postRepository.displayCommentsFromPost({
            postId,
            cursor,
            limit,
            sortBy: query.sortBy ?? "created_at",
            sortOrder: query.sortOrder ?? "desc",
        });

        return {
            postId,
            nextCursor: result.nextCursor,
            comments: (result.data ?? []).map((commentWithMedia) => ({
                commentId: commentWithMedia.comment.id,
                userId: commentWithMedia.comment.userId,
                content: commentWithMedia.comment.content,
                imageUrls: commentWithMedia.media?.filter((m) => m.mediaType === "image").map((m) => m.mediaUrl) ?? [],
                createdAt: commentWithMedia.comment.createdAt,
            })),
        };
    }
    async deleteComment(commentId: string, userId: string): Promise<void> {
        const existingComment = await this.postRepository.findCommentById(commentId);
        if (!existingComment) {
            throw new Error("Comment not found");
        }
        if (existingComment.comment.userId !== userId) {
            throw new Error("Unauthorized: You can only delete your own comments");
        }
        try {
            await Promise.all(existingComment.media.map(async (media) => {
                if (media.publicId) {
                    await this.cloudinaryService.deleteImage(media.publicId);
                }
            }));
        }
        catch (error) {
            console.error("Failed to delete comment media from Cloudinary:", error);
        }
        await this.postRepository.deleteComment(commentId);
    }

    private async uploadImages(buffers?: Buffer[]): Promise<imageArray[]> {
        if (!buffers?.length) return [];
        return this.cloudinaryService.uploadMany(buffers, "posts");
    }

    private async uploadCommentImages(buffers?: Buffer[]): Promise<imageArray[]> {
        if (!buffers?.length) return [];
        return this.cloudinaryService.uploadMany(buffers, "comments");
    }

}