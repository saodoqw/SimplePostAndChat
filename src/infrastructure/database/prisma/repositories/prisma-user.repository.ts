import { UserEntity } from '../../../../domain/entities/user.entity.js';
import {
    type UserRepository,
    type CreateUserRepositoryInput,
    type UpdateUserRepositoryInput,
} from '../../../../domain/repositories/user.repository.js';
import { type FollowEntity } from '../../../../domain/entities/follow.entity.js';
import { prisma } from '../prismaClient.js';

class UserEntityMapper {
    static toDomain(record: any): UserEntity {
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
export class PrismaUserRepository implements UserRepository {

    async create(data: CreateUserRepositoryInput): Promise<UserEntity> {
        // Call Prisma Client to create a new user in the database
        const record = await prisma.user.create({
            data: {
                username: data.username,
                email: data.email,
                password_hash: data.passwordHash,
                public_id: '',        // if upload avatar then set it, else keep it empty string
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
        throw new Error('Not implemented');
    }

    async findByUsername(username: string): Promise<UserEntity | null> {
        throw new Error('Not implemented');
    }

    async update(id: string, data: UpdateUserRepositoryInput): Promise<UserEntity> {
        throw new Error('Not implemented');
    }

    async delete(id: string): Promise<void> {
        throw new Error('Not implemented');
    }

    async followUser(followerId: string, followingId: string): Promise<FollowEntity> {
        throw new Error('Not implemented');
    }

    async unfollowUser(followerId: string, followingId: string): Promise<void> {
        throw new Error('Not implemented');
    }

    async isFollowing(followerId: string, followingId: string): Promise<boolean> {
        throw new Error('Not implemented');
    }

    async isbothFollowing(userId1: string, userId2: string): Promise<boolean> {
        throw new Error('Not implemented');
    }
}

