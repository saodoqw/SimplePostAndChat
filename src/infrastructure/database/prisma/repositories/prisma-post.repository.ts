import { PostEntity } from "../../../../domain/entities/post.entity.js";
import { PostMediaEntity } from "../../../../domain/entities/post-media.entity.js";

import {
    type CreatePostRepositoryInput,
    type CreatePostWithMediaRepositoryInput,
    type PostRepository,
    type UpdatePostRepositoryInput,
} from "../../../../domain/repositories/post.repository.js";
import {
    type Post as PrismaPostRecord,
} from "../generated/client.js";
import { prisma } from "../prismaClient.js";
import { MediaInput } from "../../../../domain/repositories/comment.repository.js";



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
    async createPostWithMedia(data: CreatePostWithMediaRepositoryInput): Promise<PostEntity> {
        const record = await prisma.post.create({
            data: {
                author_id: data.authorId,
                content: data.content,
            }
        });
        if (data.media.length > 0) {
            const mediaRecords = data.media.map(media => ({
                post_id: record.id,
                media_url: media.mediaUrl,
                media_type: media.mediaType,
                public_id: media.publicId,
            }));
            await prisma.postMedia.createMany({
                data: mediaRecords,
            });
        }
        return PostEntityMapper.toDomain(record);
    }
    async updateById(postId: string, data: UpdatePostRepositoryInput): Promise<PostEntity> {
        const record = await prisma.post.update({
            where: { id: postId },
            data: {
                content: data.content,
            }
        });
        return PostEntityMapper.toDomain(record);
    }
    async deleteById(postId: string): Promise<void> {
        await prisma.post.delete({
            where: { id: postId },
        });
    }
    async findById(postId: string): Promise<PostEntity | null> {
        const record = await prisma.post.findUnique({
            where: { id: postId },
        });
        return record ? PostEntityMapper.toDomain(record) : null;
    }

    async findMediaAssetsByPostId(postId: string): Promise<Array<MediaInput>> {
        const records = await prisma.postMedia.findMany({
            where: { post_id: postId },
            select: {
                media_type: true,
                public_id: true,
                media_url: true,
            },
        });

        return records.map((record) => ({
            mediaType: record.media_type,
            publicId: record.public_id,
            mediaUrl: record.media_url,
        }));
    }

}
