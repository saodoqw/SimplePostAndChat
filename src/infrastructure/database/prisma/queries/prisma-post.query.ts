import { prisma } from "../prismaClient.js";
import {
    FindPostQuery,
    FindPostsResult,
    PostDetailDto,
    PostQueryService
} from '../../../../application/queries/post.query.js';



export class prismaPostQuery implements PostQueryService {

    async getFeed(query: FindPostQuery): Promise<FindPostsResult> {
        const limit = query.limit;
        const sortBy = query.sortBy || 'created_at';
        const sortOrder = query.sortOrder || 'desc';
        const record = await prisma.post.findMany({
            where: {
                author_id: query.authorId,
            },
            orderBy: {
                [sortBy]: sortOrder,
            },
            take: limit + 1,
            ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 }
                : {}),
            include: {
                media: true,
                author: {
                    select: {
                        id: true,
                        username: true,
                        avatar_url: true,
                    },
                },
                PostLike: query.authUserId ? {
                    where: {
                        user_id: query.authUserId,
                    },
                } : false,
                _count: {
                    select: {
                        PostLike: true,
                        comments: true,
                    },
                },


            }
        });
        const hasNextPage = record.length > limit;
        const page = hasNextPage ? record.slice(0, limit) : record;
        const posts: PostDetailDto[] = page.map((post) => ({
            id: post.id,
            content: post.content,
            mediaUrls: post.media.map((media) => media.media_url),
            author: {
                id: post.author.id,
                username: post.author.username,
                avatarUrl: post.author.avatar_url,
            },
            likeCount: post._count.PostLike,
            commentCount: post._count.comments,
            isLiked: query.authUserId ? post.PostLike.length > 0 : false,
            createdAt: post.created_at,
        }));

        return {
            data: posts,
            nextCursor: hasNextPage ? page[page.length - 1].id : undefined,
            limit,
            sortBy,
            sortOrder,
            ...(query.cursor ? { cursor: query.cursor } : {
            })
        };
    }

    async getPostDetail(postId: string, userId?: string): Promise<PostDetailDto | null> {
        const records = await prisma.post.findUnique({
            where: {
                id: postId,
            },
            include: {
                media: true,
                author: {
                    select: {
                        id: true,
                        username: true,
                        avatar_url: true,
                    },
                },
                PostLike: userId ? {
                    where: {
                        user_id: userId,
                    },
                } : false,
                _count: {
                    select: {
                        PostLike: true,
                        comments: true,
                    },
                },
            }
        });
        if (!records) {
            return null;
        }
        return {
            id: records.id,
            content: records.content,
            mediaUrls: records.media.map((media) => media.media_url),
            author: {
                id: records.author.id,
                username: records.author.username,
                avatarUrl: records.author.avatar_url,
            },
            likeCount: records._count.PostLike,
            commentCount: records._count.comments,
            isLiked: userId ? records.PostLike.length > 0 : false,
            createdAt: records.created_at,
        };
    }
}
