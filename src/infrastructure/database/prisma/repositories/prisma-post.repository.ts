import { PostEntity } from "../../../../domain/entities/post.entity.js";
import {
    type CreatePostRepositoryInput,
    type PostRepository,
} from "../../../../domain/repositories/post.repository.js";
import { prisma } from "../prismaClient.js";

export class PrismaPostRepository implements PostRepository {
    async create(data: CreatePostRepositoryInput): Promise<PostEntity> {
        const createdPost = await prisma.post.create({
            data: {
                author_id: data.authorId,
                content: data.content,
            },
        });

        return new PostEntity({
            id: createdPost.id,
            authorId: createdPost.author_id,
            content: createdPost.content,
            createdAt: createdPost.created_at,
            updatedAt: createdPost.updated_at,
        });
    }
}