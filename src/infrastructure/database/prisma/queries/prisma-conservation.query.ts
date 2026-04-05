import { ConversationQueryService, ConversationWithUsersRepositoryResult, FindConversationsQuery, FindConversationsResult } from "../../../../application/queries/conservation.query.js";
import { prisma } from "../prismaClient.js";

export class PrismaConservationQuery implements ConversationQueryService {
    async findConversations(query: FindConversationsQuery): Promise<FindConversationsResult> {
        const limit = query.limit;
        const sortBy = query.sortBy ?? "updated_at";
        const sortOrder = query.sortOrder ?? "desc";

        const orderBy = sortBy === "updated_at"
            ? [{ updated_at: sortOrder }, { id: sortOrder }]
            : [{ created_at: sortOrder }, { id: sortOrder }];

        const records = await prisma.conversation.findMany({
            where: {
                conversationUsers: {
                    some: { user_id: query.userId },
                },
            },
            include: {
                messages: {
                    orderBy: [{ created_at: "desc" }, { id: "desc" }],
                    take: 1,
                },
            },
            orderBy,
            take: limit + 1,
            ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        });

        const hasNextPage = records.length > limit;
        const page = hasNextPage ? records.slice(0, limit) : records;

        return {
            conversations: page.map((conversation) => ({
                id: conversation.id,
                name: conversation.name,
                isGroup: conversation.is_group,
                ...(conversation.messages[0]
                    ? {
                        lastMessage: {
                            content: conversation.messages[0].content ?? "",
                            createdAt: conversation.messages[0].created_at,
                        },
                    }
                    : {}),
            })),
            nextCursor: hasNextPage ? page[page.length - 1].id : undefined,
        };
    }

    async getConversationById(conversationId: string): Promise<ConversationWithUsersRepositoryResult | null> {
        const record = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                messages: {
                    orderBy: [{ created_at: "desc" }, { id: "desc" }],
                    take: 1,
                },
                conversationUsers: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                avatar_url: true,
                            },
                        },
                    },
                },
            },
        });

        if (!record) {
            return null;
        }

        return {
            conversation: {
                id: record.id,
                name: record.name,
                isGroup: record.is_group,
                ...(record.messages[0]
                    ? {
                        lastMessage: {
                            content: record.messages[0].content ?? "",
                            createdAt: record.messages[0].created_at,
                        },
                    }
                    : {}),
            },
            users: record.conversationUsers.map((member) => ({
                id: member.user.id,
                username: member.user.username,
                avatarUrl: member.user.avatar_url,
                isAdmin: member.is_admin,
                joinedAt: member.created_at,
            })),
        };
    }

    async getDirectConversation(userId1: string, userId2: string): Promise<ConversationWithUsersRepositoryResult | null> {
        const record = await prisma.conversation.findFirst({
            where: {
                is_group: false,
                AND: [
                    { conversationUsers: { some: { user_id: userId1 } } },
                    { conversationUsers: { some: { user_id: userId2 } } },
                ],
            },
            include: {
                messages: {
                    orderBy: [{ created_at: "desc" }, { id: "desc" }],
                    take: 1,
                },
                conversationUsers: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                avatar_url: true,
                            },
                        },
                    },
                },
            },
            orderBy: [{ updated_at: "desc" }, { created_at: "desc" }],
        });

        if (!record) {
            return null;
        }

        const uniqueUsers = new Set(record.conversationUsers.map((member) => member.user_id));
        if (uniqueUsers.size !== 2) {
            return null;
        }

        return {
            conversation: {
                id: record.id,
                name: record.name,
                isGroup: record.is_group,
                ...(record.messages[0]
                    ? {
                        lastMessage: {
                            content: record.messages[0].content ?? "",
                            createdAt: record.messages[0].created_at,
                        },
                    }
                    : {}),
            },
            users: record.conversationUsers.map((member) => ({
                id: member.user.id,
                username: member.user.username,
                avatarUrl: member.user.avatar_url,
                isAdmin: member.is_admin,
                joinedAt: member.created_at,
            })),
        };
    }

    async getAllConversationsBelongToUser(userId: string): Promise<ConversationWithUsersRepositoryResult[]> {
        const records = await prisma.conversation.findMany({
            where: {
                conversationUsers: {
                    some: { user_id: userId },
                },
            },
            include: {
                messages: {
                    orderBy: [{ created_at: "desc" }, { id: "desc" }],
                    take: 1,
                },
                conversationUsers: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                avatar_url: true,
                            },
                        },
                    },
                },
            },
            orderBy: [{ updated_at: "desc" }, { id: "desc" }],
        });

        return records.map((record) => ({
            conversation: {
                id: record.id,
                name: record.name,
                isGroup: record.is_group,
                ...(record.messages[0]
                    ? {
                        lastMessage: {
                            content: record.messages[0].content ?? "",
                            createdAt: record.messages[0].created_at,
                        },
                    }
                    : {}),
            },
            users: record.conversationUsers.map((member) => ({
                id: member.user.id,
                username: member.user.username,
                avatarUrl: member.user.avatar_url,
                isAdmin: member.is_admin,
                joinedAt: member.created_at,
            })),
        }));
    }
}