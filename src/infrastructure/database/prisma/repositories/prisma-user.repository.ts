import { UserEntity } from '../../../../domain/entities/user.entity.js';
import {
    type UserRepository,
    type CreateUserRepositoryInput,
    type UpdateUserRepositoryInput,
} from '../../../../domain/repositories/user.repository.js';
import { FollowEntity } from '../../../../domain/entities/follow.entity.js';
import {
    type User as PrismaUserRecord,
    type Follow as PrismaFollowRecord
} from '../generated/client.js';
import { prisma } from '../prismaClient.js';

// Convert Prisma rows (snake_case) to domain entities (camelCase).
class UserEntityMapper {
    static toDomain(record: PrismaUserRecord): UserEntity {
        return new UserEntity({
            id: record.id,
            username: record.username,
            email: record.email,
            passwordHash: record.password_hash,
            publicId: record.public_id,
            avatarUrl: record.avatar_url,
            bio: record.bio,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
        });
    }
}
class FollowEntityMapper {
    static toDomain(record: PrismaFollowRecord): FollowEntity {
        return new FollowEntity({
            id: record.id,
            followerId: record.follower_id,
            followingId: record.following_id,
            createdAt: record.created_at,
        });
    }
}

export class PrismaUserRepository implements UserRepository {

    async create(data: CreateUserRepositoryInput): Promise<UserEntity> {
        // New users can start without avatar, so Cloudinary public_id,avatar_url is null by default.
        const record = await prisma.user.create({
            data: {
                username: data.username,
                email: data.email,
                password_hash: data.passwordHash,
                public_id: null,   
                avatar_url: null,
                bio: null,
            },
        });

        return UserEntityMapper.toDomain(record);
    }


    async findById(id: string): Promise<UserEntity | null> {

        const record = await prisma.user.findUnique({
            where: { id },
        });

        if (!record) {
            return null;
        }
        return UserEntityMapper.toDomain(record);
    }

    async findByEmail(email: string): Promise<UserEntity | null> {
        const record = await prisma.user.findUnique({
            where: { email }
        })
        if (!record) {
            return null;
        }
        return UserEntityMapper.toDomain(record);
    }

    async findByUsername(username: string): Promise<UserEntity | null> {
        const record = await prisma.user.findUnique({
            where: { username }
        })
        if (!record) {
            return null;
        }
        return UserEntityMapper.toDomain(record);
    }

    async update(id: string, data: UpdateUserRepositoryInput): Promise<UserEntity> {
        // Explicit existence check to keep a clear domain error message.
        const existingRecord = await prisma.user.findUnique({
            where: { id },
        });
        if (!existingRecord) {
            throw new Error('User not found');
        }
        const record = await prisma.user.update({
            where: { id },
            data: {
                username: data.username,
                email: data.email,
                password_hash: data.passwordHash,
                public_id: data.publicId,
                avatar_url: data.avatarUrl,
                bio: data.bio,
            },
        });
        return UserEntityMapper.toDomain(record);
    }


    async delete(id: string): Promise<void> {
        // Explicit existence check to keep a clear domain error message.
        const existingRecord = await prisma.user.findUnique({
            where: { id },
        });
        if (!existingRecord) {
            throw new Error('User not found');
        }
        await prisma.user.delete({
            where: { id },
        });
    }

    async followUser(followerId: string, followingId: string): Promise<FollowEntity> {

        // Keep behavior deterministic instead of relying on unique-constraint errors.
        const existingFollow = await prisma.follow.findUnique({
            where: {
                follower_id_following_id: {
                    follower_id: followerId,
                    following_id: followingId,
                }
            }
        });
        if (existingFollow) {
            throw new Error('Already following this user');
        }
        const record = await prisma.follow.create({
            data: {
                follower_id: followerId,
                following_id: followingId,
            }
        })
        return FollowEntityMapper.toDomain(record);
    }

    async unfollowUser(followerId: string, followingId: string): Promise<void> {

        const existingFollow = await prisma.follow.findUnique({
            where: {
                follower_id_following_id: {
                    follower_id: followerId,
                    following_id: followingId,
                }
            }
        });
        if (!existingFollow) {
            throw new Error('Already not following this user');
        }
        await prisma.follow.delete({
            where: {
                follower_id_following_id: {
                    follower_id: followerId,
                    following_id: followingId,
                }
            }
        });
    }

    async isFollowing(followerId: string, followingId: string): Promise<boolean> {
        const existingFollow = await prisma.follow.findUnique({
            where: {
                follower_id_following_id: {
                    follower_id: followerId,
                    following_id: followingId,
                }
            }
        });
        if (!existingFollow) {
            return false;
        }
        return true;
    }

    async isbothFollowing(userId1: string, userId2: string): Promise<boolean> {
        // True only when both follow directions exist.
        const follow1 = await prisma.follow.findUnique({
            where: {
                follower_id_following_id: {
                    follower_id: userId1,
                    following_id: userId2,
                }
            }
        });
        const follow2 = await prisma.follow.findUnique({
            where: {
                follower_id_following_id: {
                    follower_id: userId2,
                    following_id: userId1,
                }
            }
        });
        if (follow1 && follow2) {
            return true;
        }
        return false;
    }
}

