import { type PostEntity } from "../entities/post.entity.js";

export interface CreatePostRepositoryInput {
    authorId: string;
    content: string;
}

export interface PostRepository {
    create(data: CreatePostRepositoryInput): Promise<PostEntity>;
}