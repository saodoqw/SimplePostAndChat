import { CommentEntity } from "../../../../domain/entities/comment.entity.js";
import { CommentRepository, CreatePostCommentRepositoryInput, CreatePostCommentWithMediaRepositoryInput } from "../../../../domain/repositories/comment.repository.js";
import { type Comment as PrismaCommentRecord } from "../generated/client.js";
import { prisma } from "../prismaClient.js";

function commentEntityMapper(record: PrismaCommentRecord): CommentEntity {
    return new CommentEntity({
        id: record.id,
        postId: record.post_id,
        userId: record.user_id,
        content: record.content,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
    });
}
export class prismaCommentRepository implements CommentRepository {
    async create(data: CreatePostCommentRepositoryInput): Promise<CommentEntity> {
        const record = await prisma.comment.create({
            data: {
                post_id: data.postId,
                user_id: data.userId,
                content: data.content,
            },
        });
        return commentEntityMapper(record);
    }
    async createCommentWithMedia(data: CreatePostCommentWithMediaRepositoryInput): Promise<CommentEntity> {
        const record = await prisma.comment.create({
            data: {
                post_id: data.postId,
                user_id: data.userId,
                content: data.content,
            },
        });
        if (data.media.length > 0) {
            const mediaRecords = data.media.map(media => ({
                comment_id: record.id,
                media_url: media.mediaUrl,
                media_type: media.mediaType,
                public_id: media.publicId,
            }));
            await prisma.commentMedia.createMany({
                data: mediaRecords,
            });
        }
        return commentEntityMapper(record);

    }
    async delete(commentId: string): Promise<void> {
        await prisma.comment.delete({
            where: { id: commentId },
        });
    }
    async findById(commentId: string): Promise<CommentEntity | null> {
        const record = await prisma.comment.findUnique({
            where: { id: commentId },
        });
        return record ? commentEntityMapper(record) : null;
    }

    async findMediaAssetsByCommentId(commentId: string): Promise<Array<{ mediaType: string; publicId: string }>> {
        const records = await prisma.commentMedia.findMany({
            where: { comment_id: commentId },
            select: {
                media_type: true,
                public_id: true,
            },
        });

        return records.map((record) => ({
            mediaType: record.media_type,
            publicId: record.public_id,
        }));
    }
}  