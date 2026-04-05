
export type SortOrder = "asc" | "desc";
export type CommentSortBy = "created_at" | "updated_at";
export interface FindPostComment {
    postId: string;
    cursor?: string;
    limit: number;
    sortBy?: CommentSortBy;
    sortOrder?: SortOrder;
}


export interface CommentDto {
    id: string;
    userId: string;
    content: string;
    mediaUrls: string[];
    createdAt: Date;
}
export interface FindPostCommentsResult {
    data: CommentDto[];
    nextCursor?: string;
    limit: number;
    sortBy: CommentSortBy;
}
export interface CommentQueryService {
    getComments(query: FindPostComment): Promise<FindPostCommentsResult>;
}