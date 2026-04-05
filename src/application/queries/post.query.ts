
type SortOrder = "asc" | "desc";
type PostSortBy = "created_at" | "updated_at";

export interface FindPostsResult {
    data: PostDetailDto[];
    nextCursor?: string;
    limit: number;
    sortBy?: PostSortBy;
    sortOrder?: SortOrder;
}

export interface FindPostQuery {
    authorId?: string;
    authUserId?: string;
    cursor?: string;
    limit: number;
    sortBy?: PostSortBy;
    sortOrder?: SortOrder;
}


export interface PostDetailDto {
    id: string;
    content: string;
    mediaUrls: string[];
    author: {
        id: string;
        username: string;
        avatarUrl: string | null;
    };
    likeCount: number;
    commentCount: number;
    isLiked: boolean;
    createdAt: Date;
}
export interface PostQueryService {
    getFeed(query: FindPostQuery): Promise<FindPostsResult>;
    getPostDetail(postId: string, userId?: string): Promise<PostDetailDto | null>;
}