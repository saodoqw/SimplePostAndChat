import { CommentEntity } from "../entities/comment.entity.js";
export interface CreatePostCommentRepositoryInput {
    postId: string;
    userId: string;
    content: string;
}
export interface CreatePostCommentWithMediaRepositoryInput extends CreatePostCommentRepositoryInput {
    media: MediaInput[];
}
export interface MediaInput {
    mediaUrl: string;
    mediaType: string;
    publicId: string;
}
export interface CommentRepository {
    create(data: CreatePostCommentRepositoryInput): Promise<CommentEntity>;
    createCommentWithMedia(data: CreatePostCommentWithMediaRepositoryInput): Promise<CommentEntity>;
    delete(commentId: string): Promise<void>;
    findById(commentId: string): Promise<CommentEntity | null>;
    findMediaAssetsByCommentId(commentId: string): Promise<Array<{ mediaType: string; publicId: string }>>;
}