import { prisma } from "../prismaClient.js";
import {
    UserProfileDto,
    UserQueryService
} from '../../../../application/queries/user.query.js';

export class PrismaUserQuery implements UserQueryService {

    async getUserProfile(userEmail: string, authUserId?: string): Promise<UserProfileDto | null> {
        const record = await prisma.user.findUnique({
            where: { email: userEmail },
            select: {
                id: true,
                username: true,
                email: true,
                avatar_url: true,
                bio: true,
                _count: {
                    select: {
                        followers: true,
                        following: true,
                        posts: true,
                    },
                },
                followers: authUserId ? {
                    where: { id: authUserId },
                } : false,
            },
        });

        if (!record) {
            return null;
        }


        return {          
            id: record.id,
            username: record.username,
            email: record.email,
            avatarUrl: record.avatar_url,
            bio: record.bio,
            followersCount: record._count.followers,
            followingCount: record._count.following,
            postsCount: record._count.posts,
            // When viewing someone else and authenticated, always return a boolean.
            // Keep it undefined for unauthenticated requests or when viewing own profile.
            isFollowing:
                authUserId && authUserId !== record.id
                    ? record.followers.length > 0
                    : undefined,
        };
    }
}