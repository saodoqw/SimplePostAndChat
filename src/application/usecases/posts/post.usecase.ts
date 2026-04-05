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
        const existingPost = await this.postRepository.findById(postId);
        if (!existingPost) throw new Error("Post not found");
        if (existingPost.author_id !== userId) {
            throw new Error("Unauthorized");
        }

        const mediaAssets = await this.postRepository.findMediaAssetsByPostId(postId);

        //  delete post record from DB first, then delete media from Cloudinary, 
        // tránh trường hợp xóa media thành công nhưng lỗi ở DB thì sẽ bị mất media mà post vẫn còn, nếu xóa DB trước thì dù có lỗi gì đi nữa thì cũng không ảnh hưởng đến consistency của data
        await this.postRepository.deleteById(postId);

        // delete media from Cloudinary, không cần await vì đã xóa DB rồi, nếu có lỗi thì log lại chứ không throw nữa
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
        const post = await this.postQueryService.getPostDetail(postId, userId);
        return post ? this.toPostDetails(post) : null;
    }

    async findManyPosts(query: findUserPostsInput): Promise<UserPostsResult> {
        const authorId = query.authorId?.trim();
        if (!authorId) {
            throw new CreatePostValidationError("authorId is required");
        }

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
        const post = await this.postQueryService.getPostDetail(postId);
        if (!post) {
            throw new Error("Post not found");
        }
        return post.likeCount;
    }

    async likeUnlikePost(postId: string, userId: string): Promise<boolean> {
        await this.getPostOrThrow(postId);
        //  delegate xuống repo xử lý transaction
        const isLiked = await this.postLikeRepository.toggle(postId, userId);
        return isLiked;
    }

    async isPostLikedByUser(postId: string, userId: string): Promise<boolean> {
        const post = await this.postQueryService.getPostDetail(postId, userId);
        if (!post) {
            throw new Error("Post not found");
        }
        return post.isLiked;
    }

    async findCommentsCount(postId: string): Promise<number> {
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
        const existingComment = await this.commentRepository.findById(commentId);
        if (!existingComment) {
            throw new Error("Comment not found");
        }
        if (existingComment.userId !== userId) {
            throw new Error("Unauthorized: You can only delete your own comments");
        }

        try {
            const mediaAssets = await this.commentRepository.findMediaAssetsByCommentId(commentId);
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
        return this.cloudinaryService.uploadMany(buffers, "posts");
    }

    private async uploadCommentImages(buffers?: Buffer[]): Promise<imageArray[]> {
        if (!buffers?.length) {
            return [];
        }
        return this.cloudinaryService.uploadMany(buffers, "comments");
    }

    private async getPostOrThrow(postId: string, userId?: string) {
        const post = await this.postQueryService.getPostDetail(postId, userId);
        if (!post) throw new Error("Post not found");
        return post;
    }

    private parseLimit(limit?: number, defaultValue = 10): number {
        const parsed = Number(limit ?? defaultValue);
        if (!Number.isInteger(parsed) || parsed <= 0) {
            throw new CreatePostValidationError("limit must be a positive integer");
        }
        return parsed;
    }


}
