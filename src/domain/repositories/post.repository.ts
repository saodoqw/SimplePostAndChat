import { type PostEntity } from "../entities/post.entity.js";
import { type PostMediaEntity } from "../entities/post-media.entity.js";
import { type CommentEntity } from "../entities/comment.entity.js";
import { type CommentMediaEntity } from "../entities/comment-media.entity.js";

export interface CreatePostRepositoryInput {
    authorId: string;
    content: string;
}

export interface UpdatePostRepositoryInput {
    content?: string;
}
export interface CreatePostWithMediaRepositoryInput extends CreatePostRepositoryInput {
    media: MediaInput[];
}
interface MediaInput {
    mediaUrl: string;
    mediaType: string;
    publicId: string;
}

export interface PostRepository {
    create(data: CreatePostRepositoryInput): Promise<PostEntity>;
    createPostWithMedia(data: CreatePostWithMediaRepositoryInput): Promise<PostEntity>;
    updateById(postId: string, data: UpdatePostRepositoryInput): Promise<PostEntity>;
    deleteById(postId: string): Promise<void>;
    findById(postId: string): Promise<PostEntity | null>;
    findMediaAssetsByPostId(postId: string): Promise<Array<MediaInput>>;
}