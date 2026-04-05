export interface PostLikeRepository {
    like(postId: string, userId: string): Promise<void>;
    unlike(postId: string, userId: string): Promise<void>;
    toggle(postId: string, userId: string): Promise<boolean>;
}