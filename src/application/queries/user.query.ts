
export interface UserProfileDto {
    id: string;
    username: string;
    email: string;
    avatarUrl: string | null;
    bio: string | null;
    followersCount: number;
    followingCount: number;
    postsCount: number;
    isFollowing?: boolean;
}

export interface UserQueryService {
    getUserProfile(userEmail: string, authUserId?: string): Promise<UserProfileDto | null>;
}