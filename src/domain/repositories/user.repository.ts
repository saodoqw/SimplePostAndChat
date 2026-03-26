import {type UserEntity} from '../entities/user.entity.js';
import {type FollowEntity} from '../entities/follow.entity.js'

export interface CreateUserRepositoryInput {
    username: string;
    email: string;
    passwordHash: string;
}
export interface UpdateUserRepositoryInput {
    username?: string;
    email?: string;
    passwordHash?: string;
    publicId?: string;
    avatarUrl?: string | null;
    bio?: string | null;
}

export interface UserMediaAsset {
    publicId: string;
    mediaType: "image" | "video";
}

export interface UserRepository {
    searchUsersByUsernameOrEmail(trimmedQuery: string, searchingUserId: string): Promise<UserEntity[]>;
    create(data: CreateUserRepositoryInput): Promise<UserEntity>;
    findById(id: string): Promise<UserEntity | null>;
    findByEmail(email: string): Promise<UserEntity | null>;
    findByUsername(username: string): Promise<UserEntity | null>;
    update(id: string, data: UpdateUserRepositoryInput): Promise<UserEntity>;
    delete(id: string): Promise<void>;
    deleteAndGetMediaAssets(id: string): Promise<UserMediaAsset[]>;
    
    // Sub-domain: Follow (follow/unfollow users, check follow status)
    followUser(followerId: string, followingId: string): Promise<FollowEntity>;
    unfollowUser(followerId: string, followingId: string): Promise<void>;
    isFollowing(followerId: string, followingId: string): Promise<boolean>;
    isbothFollowing(userId1: string, userId2: string): Promise<boolean>;
    getFollowers(userId: string): Promise<UserEntity[]>;
    getFollowing(userId: string): Promise<UserEntity[]>;
}