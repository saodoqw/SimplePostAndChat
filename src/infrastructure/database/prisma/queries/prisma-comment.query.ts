import { prisma } from "../prismaClient.js";
import {
    type CommentDto,
    type CommentQueryService,
    type FindPostComment,
    type FindPostCommentsResult,
} from "../../../../application/queries/comment.query.js";

export class PrismaCommentQuery implements CommentQueryService {
    async getComments(query: FindPostComment): Promise<FindPostCommentsResult> {
        const limit = query.limit;
        const sortBy = query.sortBy || "created_at";
        const sortOrder = query.sortOrder || "desc";

        const records = await prisma.comment.findMany({
            where: {
                post_id: query.postId,
            },
            orderBy: {
                [sortBy]: sortOrder,
            },
            take: limit + 1,
            ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
            include: {
                media: true,
            },
        });

        const hasNextPage = records.length > limit;
        const page = hasNextPage ? records.slice(0, limit) : records;

        const data: CommentDto[] = page.map((comment) => ({
            id: comment.id,
            userId: comment.user_id,
            content: comment.content,
            mediaUrls: comment.media.map((media) => media.media_url),
            createdAt: comment.created_at,
        }));

        return {
            data,
            nextCursor: hasNextPage ? page[page.length - 1].id : undefined,
            limit,
            sortBy,
        };
    }
}