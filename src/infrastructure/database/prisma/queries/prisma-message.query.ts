import { FindMessagesQuery, FindMessagesResult, MessageDto, MessageQueryService } from "../../../../application/queries/message.query.js";
import { prisma } from "../prismaClient.js";

export class PrismaMessageQuery implements MessageQueryService {
    async getAllMessagesWithMedia(conversationId: string): Promise<MessageDto[]> {
        const records = await prisma.message.findMany({
            where: {
                conversation_id: conversationId,
                is_deleted: false,
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        username: true,
                        avatar_url: true,
                    },
                },
                media: true,
            },
            orderBy: [{ created_at: "desc" }, { id: "desc" }],
            take: 10,
        });

        return records.map((message) => ({
            id: message.id,
            conversationId: message.conversation_id,
            senderId: message.sender_id,
            content: message.content,
            createdAt: message.created_at,
            updatedAt: message.updated_at,
            user: {
                id: message.sender.id,
                username: message.sender.username,
                avatarUrl: message.sender.avatar_url,
            },
            media: message.media.map((item) => ({
                messageId: item.message_id,
                mediaUrl: item.media_url,
                mediaType: item.media_type,
            })),
        }));
    }

    async findMessages(query: FindMessagesQuery): Promise<FindMessagesResult> {
        const limit = query.limit;
        const sortBy = query.sortBy ?? "created_at";
        const sortOrder = query.sortOrder ?? "desc";
        const direction = query.direction ?? "up";
        const normalizedSearch = query.search?.trim() ?? "";

        const orderBy = sortBy === "updated_at"
            ? [{ updated_at: sortOrder }, { id: sortOrder }]
            : [{ created_at: sortOrder }, { id: sortOrder }];

        const records = await prisma.message.findMany({
            where: {
                conversation_id: query.conversationId,
                is_deleted: false,
                ...(normalizedSearch
                    ? {
                        content: {
                            contains: normalizedSearch,
                            mode: "insensitive",
                        },
                    }
                    : {}),
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        username: true,
                        avatar_url: true,
                    },
                },
                media: true,
            },
            orderBy,
            take: direction === "down" ? -(limit + 1) : limit + 1,
            ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        });

        const orderedRecords = direction === "down" ? [...records].reverse() : records;
        const hasMore = orderedRecords.length > limit;
        const page = hasMore ? orderedRecords.slice(0, limit) : orderedRecords;

        const items: MessageDto[] = page.map((message) => ({
            id: message.id,
            conversationId: message.conversation_id,
            senderId: message.sender_id,
            content: message.content,
            createdAt: message.created_at,
            updatedAt: message.updated_at,
            user: {
                id: message.sender.id,
                username: message.sender.username,
                avatarUrl: message.sender.avatar_url,
            },
            media: message.media.map((item) => ({
                messageId: item.message_id,
                mediaUrl: item.media_url,
                mediaType: item.media_type,
            })),
        }));

        return {
            items,
            nextCursor: items.length ? items[items.length - 1].id : undefined,
            prevCursor: items.length ? items[0].id : undefined,
        };
    }
}