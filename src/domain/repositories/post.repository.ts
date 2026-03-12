import { type PostEntity } from "../entities/post.entity.js";
import { type PostMediaEntity } from "../entities/post-media.entity.js";
import { type CommentEntity } from "../entities/comment.entity.js";
import { type CommentMediaEntity } from "../entities/comment-media.entity.js";

export interface PostMediaRepositoryInput {
    mediaUrl: string;
    mediaType: string;
    publicId: string;
}

export interface CreatePostRepositoryInput {
    authorId: string;
    content: string;
}

export interface CreatePostWithMediaRepositoryInput extends CreatePostRepositoryInput {
    media: PostMediaRepositoryInput[];
}

export interface PostWithMediaRepositoryResult {
    post: PostEntity;
    media: PostMediaEntity[];
}


export interface UpdatePostRepositoryInput {
    content?: string;
}

export interface UpdatePostWithMediaRepositoryInput extends UpdatePostRepositoryInput {
    media: PostMediaRepositoryInput[];
}

export interface FindPostQuery {
    authorId?: string;
    cursor?: string;
    limit: number;
}

export interface FindPostsResult {
    posts: PostEntity[];
    nextCursor?: string;
}

export interface FindPostComment {
    postId: string;
    cursor?: string;
    limit: number;
}
export interface CommentWithMediaRepositoryResult {
    comment: CommentEntity;
    media: CommentMediaEntity[];
}

export interface FindPostCommentsWithMediaResult {
    comments: CommentWithMediaRepositoryResult[];
    nextCursor?: string;
}

export interface CreatePostCommentRepositoryInput {
    postId: string;
    userId: string;
    content: string;
}

export interface CommentMediaRepositoryInput {
    mediaUrl: string;
    mediaType: string;
    publicId: string;
}


export interface CreatePostCommentWithMediaRepositoryInput extends CreatePostCommentRepositoryInput {
    media: CommentMediaRepositoryInput[];
}

export interface PostCommentWithMediaRepositoryResult {
    comment: CommentEntity;
    media: CommentMediaEntity[];
}

export interface PostRepository {
    // Post Create & Update
    create(data: CreatePostRepositoryInput): Promise<PostEntity>;
    updateById(postId: string, data: UpdatePostRepositoryInput): Promise<PostEntity>;
    deleteById(postId: string): Promise<void>;

    //Post create & update with media (images/videos)
    createPostWithMedia(data: CreatePostWithMediaRepositoryInput): Promise<PostWithMediaRepositoryResult>;
    updatePostWithMedia(postId: string, data: UpdatePostWithMediaRepositoryInput): Promise<PostWithMediaRepositoryResult>;

    // Find Posts
    findById(postId: string): Promise<PostEntity | null>;
    findMany(query: FindPostQuery): Promise<FindPostsResult>;


    // Sub-domain: PostLike (like/unlike)
    findLikesCount(postId: string): Promise<number>;
    likePost(postId: string, userId: string): Promise<void>;
    unlikePost(postId: string, userId: string): Promise<void>;
    isPostLikedByUser(postId: string, userId: string): Promise<boolean>;

    // Sub-domain: PostComment (add/retrieve/remove comments)
    findCommentCount(postId: string): Promise<number>;
    createComment(data: CreatePostCommentRepositoryInput): Promise<CommentEntity>;
    createCommentWithMedia(data: CreatePostCommentWithMediaRepositoryInput): Promise<PostCommentWithMediaRepositoryResult>;
    findComments(query: FindPostComment): Promise<FindPostCommentsWithMediaResult>;
    deleteComment(commentId: string): Promise<void>;
    
}