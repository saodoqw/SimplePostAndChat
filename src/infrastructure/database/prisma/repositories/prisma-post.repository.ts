import { PostEntity } from "../../../../domain/entities/post.entity.js";
import { PostMediaEntity } from "../../../../domain/entities/post-media.entity.js";
import { CommentEntity } from "../../../../domain/entities/comment.entity.js";
import { CommentMediaEntity } from "../../../../domain/entities/comment-media.entity.js";
import {
    type CommentSortBy,
    type CreatePostCommentRepositoryInput,
    type CreatePostCommentWithMediaRepositoryInput,
    type CreatePostRepositoryInput,
    type CreatePostWithMediaRepositoryInput,
    type FindPostComment,
    type FindPostCommentsResult,
    type FindPostQuery,
    type FindPostsResult,
    type PostCommentWithMediaRepositoryResult,
    type PostRepository,
    type PostSortBy,
    type PostWithMediaRepositoryResult,
    type SortOrder,
    type UpdatePostRepositoryInput,
    type UpdatePostWithMediaRepositoryInput,
} from "../../../../domain/repositories/post.repository.js";
import {
    type Comment as PrismaCommentRecord,
    type CommentMedia as PrismaCommentMediaRecord,
    type Post as PrismaPostRecord,
    type PostMedia as PrismaPostMediaRecord,
} from "../generated/client.js";
import { prisma } from "../prismaClient.js";

const DEFAULT_SORT_ORDER: SortOrder = "desc";
const DEFAULT_POST_SORT_BY: PostSortBy = "created_at";
const DEFAULT_COMMENT_SORT_BY: CommentSortBy = "created_at";

class PostEntityMapper {
    static toDomain(record: PrismaPostRecord): PostEntity {
        return new PostEntity({
            id: record.id,
            author_id: record.author_id,
            content: record.content,
            created_at: record.created_at,
            updated_at: record.updated_at,
        });
    }
}

class PostMediaEntityMapper {
    static toDomain(record: PrismaPostMediaRecord): PostMediaEntity {
        return new PostMediaEntity({
            id: record.id,
            postId: record.post_id,
            mediaUrl: record.media_url,
            mediaType: record.media_type,
            publicId: record.public_id,
            createdAt: record.created_at,
        });
    }
}

class CommentEntityMapper {
    static toDomain(record: PrismaCommentRecord): CommentEntity {
        return new CommentEntity({
            id: record.id,
            postId: record.post_id,
            userId: record.user_id,
            content: record.content,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
        });
    }
}

class CommentMediaEntityMapper {
    static toDomain(record: PrismaCommentMediaRecord): CommentMediaEntity {
        return new CommentMediaEntity({
            id: record.id,
            commentId: record.comment_id,
            mediaUrl: record.media_url,
            mediaType: record.media_type,
            publicId: record.public_id,
            createdAt: record.created_at,
        });
    }
}

export class PrismaPostRepository implements PostRepository {
    async create(data: CreatePostRepositoryInput): Promise<PostEntity> {
        const record = await prisma.post.create({
            data: {
                author_id: data.authorId,
                content: data.content,
            },
        });

        return PostEntityMapper.toDomain(record);
    }

    async updateById(postId: string, data: UpdatePostRepositoryInput): Promise<PostEntity> {
        await this.ensurePostExists(postId);

        const record = await prisma.post.update({
            where: { id: postId },
            data: {
                content: data.content,
            },
        });

        return PostEntityMapper.toDomain(record);
    }

    async deleteById(postId: string): Promise<void> {
        await this.ensurePostExists(postId);

        await prisma.post.delete({
            where: { id: postId },
        });
    }

    async createPostWithMedia(
        data: CreatePostWithMediaRepositoryInput
    ): Promise<PostWithMediaRepositoryResult> {
        const transactionResult = await prisma.$transaction(async (tx) => {
            const postRecord = await tx.post.create({
                data: {
                    author_id: data.authorId,
                    content: data.content,
                },
            });
            const mediaRecords = await Promise.all(
                data.media.map((item) =>
                    tx.postMedia.create({
                        data: {
                            post_id: postRecord.id,
                            media_url: item.mediaUrl,
                            media_type: item.mediaType,
                            public_id: item.publicId,
                        },
                    })
                )
            );

            return {
                post: PostEntityMapper.toDomain(postRecord),
                media: mediaRecords.map((record) => PostMediaEntityMapper.toDomain(record)),
            };
        });
        return transactionResult;
    }

    // async updatePostWithMedia(
    //     postId: string,
    //     data: UpdatePostWithMediaRepositoryInput
    // ): Promise<PostWithMediaRepositoryResult> {
    //     return prisma.$transaction(async (tx) => {
    //         const existingRecord = await tx.post.findUnique({
    //             where: { id: postId },
    //         });

    //         if (!existingRecord) {
    //             throw new Error("Post not found");
    //         }

    //         const postRecord = await tx.post.update({
    //             where: { id: postId },
    //             data: {
    //                 content: data.content,
    //             },
    //         });

    //         await tx.postMedia.deleteMany({
    //             where: { post_id: postId },
    //         });

    //         if (data.media.length) {
    //             await tx.postMedia.createMany({
    //                 data: data.media.map((item) => ({
    //                     post_id: postId,
    //                     media_url: item.mediaUrl,
    //                     media_type: item.mediaType,
    //                     public_id: item.publicId,
    //                 })),
    //             });
    //         }

    //         const mediaRecords = await tx.postMedia.findMany({
    //             where: { post_id: postId },
    //             orderBy: { created_at: "asc" },
    //         });

    //         return {
    //             post: PostEntityMapper.toDomain(postRecord),
    //             media: mediaRecords.map((record) => PostMediaEntityMapper.toDomain(record)),
    //         };
    //     });
    // }

    async findById(postId: string): Promise<PostWithMediaRepositoryResult | null> {
        const record = await prisma.post.findUnique({
            where: { id: postId },
            include: { media: true },
        });

        if (!record) {
            return null;
        }

        return {
            post: PostEntityMapper.toDomain(record),
            media: record.media.map((mediaRecord) => PostMediaEntityMapper.toDomain(mediaRecord)),
        };
    }

    async findManyPosts(query: FindPostQuery): Promise<FindPostsResult> {
        const limit = this.normalizeLimit(query.limit);
        const sortBy = query.sortBy ?? DEFAULT_POST_SORT_BY;
        const sortOrder = query.sortOrder ?? DEFAULT_SORT_ORDER;

        const records = await prisma.post.findMany({
            where: {
                ...(query.authorId ? { author_id: query.authorId } : {}),
            }, take: limit + 1,
            orderBy: this.buildPostOrderBy(sortBy, sortOrder),
            ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
            include: { media: true },
        });

        const hasNextCursor = records.length > limit;
        // Slice the records to return only the requested page size
        const pageRecords = hasNextCursor ? records.slice(0, limit) : records;
        return {
            data: pageRecords.map((record) => ({
                post: PostEntityMapper.toDomain(record),
                media: record.media.map((mediaRecord) => PostMediaEntityMapper.toDomain(mediaRecord)),
            })),
            nextCursor: hasNextCursor && pageRecords.length ? pageRecords[pageRecords.length - 1].id : undefined,
            limit,
            sortBy,
        };
    }


    async findLikesCount(postId: string): Promise<number> {
        return prisma.postLike.count({
            where: { post_id: postId },
        });
    }

    async likePost(postId: string, userId: string): Promise<void> {
        await this.ensurePostExists(postId);

        const existingLike = await prisma.postLike.findUnique({
            where: {
                post_id_user_id: {
                    post_id: postId,
                    user_id: userId,
                },
            },
        });

        if (existingLike) {
            throw new Error("Post already liked by user");
        }

        await prisma.postLike.create({
            data: {
                post_id: postId,
                user_id: userId,
            },
        });
    }

    async unlikePost(postId: string, userId: string): Promise<void> {
        await this.ensurePostExists(postId);

        const existingLike = await prisma.postLike.findUnique({
            where: {
                post_id_user_id: {
                    post_id: postId,
                    user_id: userId,
                },
            },
        });

        if (!existingLike) {
            throw new Error("Post is not liked by user");
        }

        await prisma.postLike.delete({
            where: {
                post_id_user_id: {
                    post_id: postId,
                    user_id: userId,
                },
            },
        });
    }

    async isPostLikedByUser(postId: string, userId: string): Promise<boolean> {
        const existingLike = await prisma.postLike.findUnique({
            where: {
                post_id_user_id: {
                    post_id: postId,
                    user_id: userId,
                },
            },
        });

        return Boolean(existingLike);
    }

    async findCommentCount(postId: string): Promise<number> {
        return prisma.comment.count({
            where: { post_id: postId },
        });
    }

    async createComment(data: CreatePostCommentRepositoryInput): Promise<CommentEntity> {
        await this.ensurePostExists(data.postId);

        const record = await prisma.comment.create({
            data: {
                post_id: data.postId,
                user_id: data.userId,
                content: data.content,
            },
        });

        return CommentEntityMapper.toDomain(record);
    }

    async createCommentWithMedia(
        data: CreatePostCommentWithMediaRepositoryInput
    ): Promise<PostCommentWithMediaRepositoryResult> {
        return prisma.$transaction(async (tx) => {
            const existingPost = await tx.post.findUnique({
                where: { id: data.postId },
            });

            if (!existingPost) {
                throw new Error("Post not found");
            }

            const commentRecord = await tx.comment.create({
                data: {
                    post_id: data.postId,
                    user_id: data.userId,
                    content: data.content,
                },
            });

            if (data.media.length) {
                await tx.commentMedia.createMany({
                    data: data.media.map((item) => ({
                        comment_id: commentRecord.id,
                        media_url: item.mediaUrl,
                        media_type: item.mediaType,
                        public_id: item.publicId,
                    })),
                });
            }

            const mediaRecords = await tx.commentMedia.findMany({
                where: { comment_id: commentRecord.id },
                orderBy: { created_at: "asc" },
            });

            return {
                comment: CommentEntityMapper.toDomain(commentRecord),
                media: mediaRecords.map((record) => CommentMediaEntityMapper.toDomain(record)),
            };
        });
    }

    async displayCommentsFromPost(query: FindPostComment): Promise<FindPostCommentsResult> {
        await this.ensurePostExists(query.postId);
        const limit = this.normalizeLimit(query.limit);
        const sortBy = query.sortBy ?? DEFAULT_COMMENT_SORT_BY;
        const sortOrder = query.sortOrder ?? DEFAULT_SORT_ORDER;

        const records = await prisma.comment.findMany({
            where: { post_id: query.postId },
            orderBy: this.buildCommentOrderBy(sortBy, sortOrder),
            take: limit + 1,
            ...(query.cursor
                ? {
                    cursor: { id: query.cursor },
                    skip: 1,
                }
                : {}),
            include: { media: true },
        });

        const hasNextCursor = records.length > limit;
        const pageRecords = hasNextCursor ? records.slice(0, limit) : records;
        return {
            data: pageRecords.map((record) => ({
                comment: CommentEntityMapper.toDomain(record),
                media: record.media.map((mediaRecord) => CommentMediaEntityMapper.toDomain(mediaRecord)),
            })),
            nextCursor:
                hasNextCursor && pageRecords.length
                    ? pageRecords[pageRecords.length - 1].id
                    : undefined,
            limit,
            sortBy,
        };
    }
    async findCommentById(commentId: string): Promise<PostCommentWithMediaRepositoryResult | null> {
        const record = await prisma.comment.findUnique({
            where: { id: commentId },
            include: { media: true },
        });
        return record ? {
            comment: CommentEntityMapper.toDomain(record),
            media: record.media.map((mediaRecord) => CommentMediaEntityMapper.toDomain(mediaRecord)),
        }
            : null;
    }

    async deleteComment(commentId: string): Promise<void> {
        await this.ensureCommentExists(commentId);

        await prisma.comment.delete({
            where: { id: commentId },
        });
    }
    // Utility method to build orderBy clause for posts, comments
    private buildPostOrderBy(sortBy: PostSortBy, sortOrder: SortOrder) {
        if (sortBy === "updated_at") {
            return [{ updated_at: sortOrder }, { id: sortOrder }];
        }

        return [{ created_at: sortOrder }, { id: sortOrder }];
    }

    private buildCommentOrderBy(sortBy: CommentSortBy, sortOrder: SortOrder) {
        if (sortBy === "updated_at") {
            return [{ updated_at: sortOrder }, { id: sortOrder }];
        }

        return [{ created_at: sortOrder }, { id: sortOrder }];
    }
    // Utility method to check if exists by ID
    private async ensurePostExists(postId: string): Promise<void> {
        const existingRecord = await prisma.post.findUnique({
            where: { id: postId },
        });

        if (!existingRecord) {
            throw new Error("Post not found");
        }
    }

    private async ensureCommentExists(commentId: string): Promise<void> {
        const existingRecord = await prisma.comment.findUnique({
            where: { id: commentId },
        });

        if (!existingRecord) {
            throw new Error("Comment not found");
        }
    }
    // Utility method to validate and normalize the limit parameter
    private normalizeLimit(limit: number): number {
        if (!Number.isInteger(limit) || limit <= 0) {
            throw new Error("Limit must be a positive integer");
        }

        return limit;
    }
}
