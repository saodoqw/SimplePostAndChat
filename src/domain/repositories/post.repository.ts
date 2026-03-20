import { type PostEntity } from "../entities/post.entity.js";
import { type PostMediaEntity } from "../entities/post-media.entity.js";
import { type CommentEntity } from "../entities/comment.entity.js";
import { type CommentMediaEntity } from "../entities/comment-media.entity.js";


export type SortOrder = "asc" | "desc";
export type PostSortBy = "created_at" | "updated_at";
export type CommentSortBy = "created_at" | "updated_at";



export interface CreatePostRepositoryInput {
    authorId: string;
    content: string;
}

export interface UpdatePostRepositoryInput {
    content?: string;
}

export interface FindPostQuery {
    authorId?: string;
    cursor?: string;
    limit: number;
    sortBy?: PostSortBy;
    sortOrder?: SortOrder;
}

export interface CommentWithMediaRepositoryResult {
    comment: CommentEntity;
    media: CommentMediaEntity[];
}

export interface PostWithMediaRepositoryResult {
    post: PostEntity;
    media: PostMediaEntity[];
}

export interface CreatePostWithMediaRepositoryInput extends CreatePostRepositoryInput {
    media: MediaInput[];
}

export interface UpdatePostWithMediaRepositoryInput extends UpdatePostRepositoryInput {
    media: MediaInput[];
}

export interface MediaInput {
    mediaUrl: string;
    mediaType: string;
    publicId: string;
}

export interface FindPostsResult {
    data: PostWithMediaRepositoryResult[];
    nextCursor?: string;
    limit: number;
    sortBy: PostSortBy;
}

export interface FindPostCommentsResult {
    data: CommentWithMediaRepositoryResult[];
    nextCursor?: string;
    limit: number;
    sortBy: CommentSortBy;
}

export interface FindPostComment {
    postId: string;
    cursor?: string;
    limit: number;
    sortBy?: CommentSortBy;
    sortOrder?: SortOrder;
}

export interface CreatePostCommentRepositoryInput {
    postId: string;
    userId: string;
    content: string;
}

export interface PostCommentWithMediaRepositoryResult {
    comment: CommentEntity;
    media: CommentMediaEntity[];
}
export interface CreatePostCommentWithMediaRepositoryInput extends CreatePostCommentRepositoryInput {
    media: MediaInput[];
}

export interface PostRepository {
    // Post Create & Update
    create(data: CreatePostRepositoryInput): Promise<PostEntity>;
    updateById(postId: string, data: UpdatePostRepositoryInput): Promise<PostEntity>;
    deleteById(postId: string): Promise<void>;

    //Post create & update with media (images/videos)
    createPostWithMedia(data: CreatePostWithMediaRepositoryInput): Promise<PostWithMediaRepositoryResult>;
    // updatePostWithMedia(postId: string, data: UpdatePostWithMediaRepositoryInput): Promise<PostWithMediaRepositoryResult>;

    // Find Posts
    findById(postId: string): Promise<PostWithMediaRepositoryResult | null>;
    findManyPosts(query: FindPostQuery): Promise<FindPostsResult>;


    // Sub-domain: PostLike (like/unlike)
    findLikesCount(postId: string): Promise<number>;
    likePost(postId: string, userId: string): Promise<void>;
    unlikePost(postId: string, userId: string): Promise<void>;
    isPostLikedByUser(postId: string, userId: string): Promise<boolean>;

    // Sub-domain: PostComment (add/retrieve/remove comments)
    findCommentCount(postId: string): Promise<number>;
    findCommentById(commentId: string): Promise<CommentEntity | null>;
    createComment(data: CreatePostCommentRepositoryInput): Promise<CommentEntity>;
    createCommentWithMedia(data: CreatePostCommentWithMediaRepositoryInput): Promise<PostCommentWithMediaRepositoryResult>;
    displayCommentsFromPost(query: FindPostComment): Promise<FindPostCommentsResult>;
    deleteComment(commentId: string): Promise<void>;

}