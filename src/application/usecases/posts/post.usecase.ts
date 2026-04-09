import { PostEntityValidationError } from "../../../domain/entities/post.entity.js";
import { type PostRepository } from "../../../domain/repositories/post.repository.js";
import {
    type CommentRepository,
    type CreatePostCommentRepositoryInput,
} from "../../../domain/repositories/comment.repository.js";
import { type PostLikeRepository } from "../../../domain/repositories/postlike.repository.js";
import {
    type CommentQueryService,
    type FindPostComment,
} from "../../../application/queries/comment.query.js";
import {
    type PostDetailDto,
    type PostQueryService,
} from "../../../application/queries/post.query.js";
import { type ImageStorageService } from "../../ports/image-storage.service.js";

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
    authorUsername?: string;
    authorAvatarUrl?: string | null;
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
        private readonly postQueryService: PostQueryService,
        private readonly postLikeRepository: PostLikeRepository,
        private readonly commentRepository: CommentRepository,
        private readonly commentQueryService: CommentQueryService,
        private readonly cloudinaryService: ImageStorageService,
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
            // Text-only posts can be written directly without touching Cloudinary.
            if (!input.imageBuffer?.length) {
                const createdPost = await this.postRepository.create({
                    authorId,
                    content,
                });

                return {
                    id: createdPost.id,
                    authorId: createdPost.author_id,
                    content: createdPost.content,
                    createdAt: createdPost.created_at,
                };
            }

            // Media posts upload first, then persist the returned URLs and public IDs.
            const uploadedImages = await this.uploadImages(input.imageBuffer);
            const createdPost = await this.postRepository.createPostWithMedia({
                authorId,
                content,
                media: uploadedImages.map((image) => ({
                    mediaUrl: image.url,
                    mediaType: "image",
                    publicId: image.publicId,
                })),
            });

            return {
                id: createdPost.id,
                authorId: createdPost.author_id,
                content: createdPost.content,
                imageUrls: uploadedImages.map((image) => image.url),
                createdAt: createdPost.created_at,
            };
        } catch (error) {
            if (error instanceof PostEntityValidationError) {
                throw new CreatePostValidationError(error.message);
            }
            throw error;
        }
    }

    async updatePost(postId: string, content: string, userId: string): Promise<updatePostOutput> {
        // Ownership check belongs here so controllers do not repeat business rules.
        const existingPost = await this.postRepository.findById(postId);
        if (!existingPost) {
            throw new Error("Post not found");
        }
        if (existingPost.author_id !== userId) {
            throw new Error("Unauthorized: You can only update your own posts");
        }

        await this.postRepository.updateById(postId, { content });
        const displayedPost = await this.postQueryService.getPostDetail(postId, userId);
        if (!displayedPost) {
            throw new Error("Post not found");
        }

        return {
            postId: displayedPost.id,
            authorId: displayedPost.author.id,
            content: displayedPost.content,
            imageUrls: displayedPost.mediaUrls,
            createdAt: displayedPost.createdAt,
        };
    }

    async deletePost(postId: string, userId: string): Promise<void> {
        // Validate ownership before deleting anything from DB or external storage.
        const existingPost = await this.postRepository.findById(postId);
        if (!existingPost) throw new Error("Post not found");
        if (existingPost.author_id !== userId) {
            throw new Error("Unauthorized");
        }

        const mediaAssets = await this.postRepository.findMediaAssetsByPostId(postId);

        //  delete post record from DB first, then delete media from Cloudinary, 
        // tránh trường hợp xóa media thành công nhưng lỗi ở DB thì sẽ bị mất media mà post vẫn còn, nếu xóa DB trước thì dù có lỗi gì đi nữa thì cũng không ảnh hưởng đến consistency của data
        await this.postRepository.deleteById(postId);

        // Cloudinary cleanup is best-effort after the database delete has succeeded.
        Promise.all(
            mediaAssets.map(async (media) => {
                try {
                    if (!media.publicId) return;
                    if (media.mediaType === "video") {
                        await this.cloudinaryService.deleteVideo(media.publicId);
                    } else {
                        await this.cloudinaryService.deleteImage(media.publicId);
                    }
                } catch (err) {
                    console.error("Cloudinary delete failed:", err);
                }
            }),
        );
    }

    async findDetailedPostById(postId: string, userId: string): Promise<postDetails | null> {
        // Read model returns a richer DTO; this use case only reshapes it for the caller.
        const post = await this.postQueryService.getPostDetail(postId, userId);
        return post ? this.toPostDetails(post) : null;
    }

    async findManyPosts(query: findUserPostsInput): Promise<UserPostsResult> {
        const authorId = query.authorId?.trim();
        if (!authorId) {
            throw new CreatePostValidationError("authorId is required");
        }

        // Normalize paging/sorting here so every caller gets the same feed behavior.
        const result = await this.postQueryService.getFeed({
            authorId,
            authUserId: query.authUserId?.trim(),
            cursor: query.cursor?.trim(),
            limit: this.parseLimit(query.limit),
            sortBy: query.sortBy ?? "created_at",
            sortOrder: query.sortOrder ?? "desc",
        });

        return {
            authorId,
            nextCursor: result.nextCursor,
            posts: result.data.map((post) => this.toPostDetails(post)),
        };
    }

    async likeCountPost(postId: string): Promise<number> {
        // Like count is read from the query service instead of recomputing it.
        const post = await this.postQueryService.getPostDetail(postId);
        if (!post) {
            throw new Error("Post not found");
        }
        return post.likeCount;
    }

    async likeUnlikePost(postId: string, userId: string): Promise<boolean> {
        await this.getPostOrThrow(postId);
        // Toggle lives in the repository because it owns the transactional write.
        const isLiked = await this.postLikeRepository.toggle(postId, userId);
        return isLiked;
    }

    async isPostLikedByUser(postId: string, userId: string): Promise<boolean> {
        // The read model already knows whether the authenticated user liked the post.
        const post = await this.postQueryService.getPostDetail(postId, userId);
        if (!post) {
            throw new Error("Post not found");
        }
        return post.isLiked;
    }

    async findCommentsCount(postId: string): Promise<number> {
        // Comment count also comes from the read model to stay consistent with feed data.
        const post = await this.postQueryService.getPostDetail(postId);
        if (!post) {
            throw new Error("Post not found");
        }
        return post.commentCount;
    }

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

        // Comments follow the same pattern as posts: text-only or with uploaded media.
        if (!data.imageBuffer?.length) {
            const createdComment = await this.commentRepository.create({
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
        const createdComment = await this.commentRepository.createCommentWithMedia({
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
            commentId: createdComment.id,
            userId: createdComment.userId,
            content: createdComment.content,
            imageUrls: uploadedImages.map((image) => image.url),
            createdAt: createdComment.createdAt,
        };
    }

    async displayCommentsFromPost(query: FindPostComment): Promise<postCommentsResult> {
        const postId = query.postId?.trim();
        if (!postId) {
            throw new CreatePostValidationError("postId is required");
        }

        await this.getPostOrThrow(postId);

        // Keep pagination logic in the application layer so the controller stays thin.
        const result = await this.commentQueryService.getComments({
            postId,
            cursor: query.cursor?.trim(),
            limit: this.parseLimit(query.limit),
            sortBy: query.sortBy ?? "created_at",
            sortOrder: query.sortOrder ?? "desc",
        });

        return {
            postId,
            nextCursor: result.nextCursor,
            comments: result.data.map((comment) => ({
                commentId: comment.id,
                userId: comment.userId,
                content: comment.content,
                imageUrls: comment.mediaUrls,
                createdAt: comment.createdAt,
            })),
        };
    }

    async deleteComment(commentId: string, userId: string): Promise<void> {
        // Ownership check is a business rule, not a transport concern.
        const existingComment = await this.commentRepository.findById(commentId);
        if (!existingComment) {
            throw new Error("Comment not found");
        }
        if (existingComment.userId !== userId) {
            throw new Error("Unauthorized: You can only delete your own comments");
        }

        try {
            const mediaAssets = await this.commentRepository.findMediaAssetsByCommentId(commentId);
            // Media cleanup is best-effort: if Cloudinary fails, the comment still gets removed.
            await Promise.all(
                mediaAssets.map(async (media) => {
                    if (!media.publicId) {
                        return;
                    }
                    if (media.mediaType === "video") {
                        await this.cloudinaryService.deleteVideo(media.publicId);
                        return;
                    }
                    await this.cloudinaryService.deleteImage(media.publicId);
                }),
            );
        } catch (error) {
            console.error("Failed to delete comment media from Cloudinary:", error);
        }

        await this.commentRepository.delete(commentId);
    }

    private toPostDetails(post: PostDetailDto): postDetails {
        // Pure mapper from read DTO to the shape the controller expects.
        return {
            postId: post.id,
            authorId: post.author.id,
            authorUsername: post.author.username,
            authorAvatarUrl: post.author.avatarUrl,
            content: post.content,
            imageUrls: post.mediaUrls,
            createdAt: post.createdAt,
            likeCount: post.likeCount,
            commentsCount: post.commentCount,
            isLikedByAuthUser: post.isLiked,
        };
    }

    private async uploadImages(buffers?: Buffer[]): Promise<imageArray[]> {
        if (!buffers?.length) {
            return [];
        }
        // Explicit folder keeps post assets separated from other media types.
        return this.cloudinaryService.uploadMany(buffers, "posts");
    }

    private async uploadCommentImages(buffers?: Buffer[]): Promise<imageArray[]> {
        if (!buffers?.length) {
            return [];
        }
        // Comments use their own folder for easier cleanup and browsing.
        return this.cloudinaryService.uploadMany(buffers, "comments");
    }

    private async getPostOrThrow(postId: string, userId?: string) {
        // Shared guard so every method that needs a post record uses the same check.
        const post = await this.postQueryService.getPostDetail(postId, userId);
        if (!post) throw new Error("Post not found");
        return post;
    }

    private parseLimit(limit?: number, defaultValue = 10): number {
        // One place for pagination validation keeps all list endpoints consistent.
        const parsed = Number(limit ?? defaultValue);
        if (!Number.isInteger(parsed) || parsed <= 0) {
            throw new CreatePostValidationError("limit must be a positive integer");
        }
        return parsed;
    }


}
