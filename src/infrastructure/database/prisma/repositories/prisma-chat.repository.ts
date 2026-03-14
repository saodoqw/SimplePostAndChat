import { ConversationEntity } from "../../../../domain/entities/conversation.entity.js";
import { MessageMediaEntity } from "../../../../domain/entities/message-media.entity.js";
import { MessageEntity } from "../../../../domain/entities/message.entity.js";
import {
    ChatRepository,
    ConversationWithUsersRepositoryResult,
    CreateConversationRepositoryInput,
    CreateMessageRepositoryInput,
    CreateMessageWithMediaRepositoryInput,
    FindConversationsQuery,
    FindConversationsResult,
    FindMessagesQuery,
    FindMessagesResult,
    MessageWithMediaRepositoryResult,
    UpdateConversationRepositoryInput,
    UpdateMessageRepositoryInput,
    SortOrder,
    MessageSortBy,
    ConversationSortBy
} from "../../../../domain/repositories/chat.repository.js";
import {
    type Conversation as PrismaConversationRecord,
    type Message as PrismaMessageRecord,
    type MessageMedia as PrismaMessageMediaRecord
} from "../../prisma/generated/client.js";
import { prisma } from "../prismaClient.js";

const DEFAULT_MESSAGE_SORTED: SortOrder = "desc";
const DEFAULT_MESSAGE_SORT_BY: MessageSortBy = "created_at";
const DEFAULT_CONVERSATION_SORTED: ConversationSortBy = "created_at";


class ConversationEntityMapper {
    static toEntity(record: PrismaConversationRecord): ConversationEntity {
        return new ConversationEntity({
            id: record.id,
            name: record.name,
            isGroup: record.is_group,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
        }
        );
    }
}
class MessageEntityMapper {
    static toEntity(record: PrismaMessageRecord): MessageEntity {
        return new MessageEntity({
            id: record.id,
            conversationId: record.conversation_id,
            senderId: record.sender_id,
            content: record.content,
            isDeleted: record.is_deleted,
            createdAt: record.created_at,
            updatedAt: record.updated_at,
        }
        );
    }
}
class MessageMediaEntityMapper {
    static toEntity(record: PrismaMessageMediaRecord) {
        return new MessageMediaEntity({
            id: record.id,
            messageId: record.message_id,
            mediaUrl: record.media_url,
            mediaType: record.media_type,
            publicId: record.public_id,
            createdAt: record.created_at,
        }
        );
    }
}

export class PrismaChatRepository implements ChatRepository {

    async createConversation(input: CreateConversationRepositoryInput)
        : Promise<ConversationEntity> {
        const userIds = [...new Set(input.userIds)];
        if (!userIds || userIds.length === 0) {
            throw new Error("At least one user ID is required to create a conversation.");
        }

        // Check if it's a one-on-one conversation and if it already exists
        if (!input.isGroup && userIds.length === 2) {
            const existingConversation = await prisma.conversation.findFirst({
                where: {
                    is_group: false,
                    conversationUsers: {
                        some: { user_id: userIds[0] }
                    },
                    AND: {
                        conversationUsers: {
                            some: { user_id: userIds[1] }
                        }
                    }
                },
                include: {
                    conversationUsers: true
                }
            });
            if (existingConversation) {
                return ConversationEntityMapper.toEntity(existingConversation);
            }
            const conversationRecord = await prisma.conversation.create({
                data: {
                    name: input.name,
                    is_group: false,
                    conversationUsers: {
                        create: userIds.map((userId) => ({ user_id: userId }))
                    }
                }
            });
            return ConversationEntityMapper.toEntity(conversationRecord);
        }
        // For group conversations 
        if (!input.creatorUserId) {
            throw new Error("creatorUserId is required to create a group conversation.");
        }
        if (!userIds.includes(input.creatorUserId)) {
            throw new Error("creatorUserId must be included in userIds.");
        }
        const conversationRecord = await prisma.conversation.create({
            data: {
                name: input.name,
                is_group: input.isGroup ?? false,
                conversationUsers: {
                    create: userIds.map((userId) => ({
                        user_id: userId,
                        is_admin: userId === input.creatorUserId,
                    }))
                }
            }
        });

        return ConversationEntityMapper.toEntity(conversationRecord);
    }
    async updateConversation(conversationId: string, input: UpdateConversationRepositoryInput): Promise<ConversationEntity> {

        const existingConversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
        });
        if (!existingConversation) {
            throw new Error("Conversation not found.");
        }
        const updatedConversation = await prisma.conversation.update({
            where: { id: conversationId },
            data: {
                name: input.name,
            }
        });
        return ConversationEntityMapper.toEntity(updatedConversation);
    }

    async deleteConversation(conversationId: string): Promise<void> {
        const existingConversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
        });
        if (!existingConversation) {
            throw new Error("Conversation not found.");
        }
        await prisma.conversation.delete({
            where: { id: conversationId },
        });
    }
    async findConversations(query: FindConversationsQuery): Promise<FindConversationsResult> {
        const limit = this.normalizeLimit(query.limit);
        const sortBy = query.sortBy ?? DEFAULT_CONVERSATION_SORTED;
        const sortOrder = query.sortOrder ?? DEFAULT_MESSAGE_SORTED;

        const records = await prisma.conversation.findMany({
            where: {
                conversationUsers: {
                    some: { user_id: query.userId }
                }
            },
            orderBy: this.buildConversationOrderBy(sortBy, sortOrder),
            take: limit + 1,
            ...(query.cursor ? {
                cursor: { id: query.cursor },
                skip: 1,

            } : {})
        });
        const hasNextCursor = records.length > limit;
        const pagedRecords = hasNextCursor ? records.slice(0, limit) : records;

        return {
            conversations: pagedRecords.map((record) => ConversationEntityMapper.toEntity(record)),
            nextCursor:
                hasNextCursor && pagedRecords.length
                    ? pagedRecords[pagedRecords.length - 1].id
                    : undefined,
        };
    }
    async findConversationWithUsers(conversationId: string): Promise<ConversationWithUsersRepositoryResult> {
        const conversationRecord = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
                conversationUsers: true,
            }
        });
        if (!conversationRecord) {
            throw new Error("Conversation not found.");
        }
        const conversationEntity = ConversationEntityMapper.toEntity(conversationRecord);
        const users = conversationRecord.conversationUsers.map((cu) => ({
            id: cu.id,
            userId: cu.user_id,
            conversationId: cu.conversation_id,
            admin: cu.is_admin,
            createdAt: cu.created_at,
        }));
        return {
            conversation: conversationEntity,
            users,
        };
    }
    async addUsersToConversation(conversationId: string, userIds: string[]): Promise<void> {
        const existingConversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
        });
        if (!existingConversation) {
            throw new Error("Conversation not found.");
        }
        const existingUserIds = await prisma.conversationUser.findFirst({
            where: { conversation_id: conversationId, user_id: { in: userIds } },
        });
        if (existingUserIds) {
            throw new Error("One or more users are already in the conversation.");
        }
        const addToConversationData = userIds.map((userId) => ({
            conversation_id: conversationId,
            user_id: userId,
            is_admin: false,
        }));
        await prisma.conversationUser.createMany({
            data: addToConversationData,
        });
    }
    async removeUsersFromConversation(conversationId: string, userIds: string[]): Promise<void> {
        const existingConversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
        });
        if (!existingConversation) {
            throw new Error("Conversation not found.");
        }
        const existingUserIds = await prisma.conversationUser.findMany({
            where: { conversation_id: conversationId, user_id: { in: userIds } },
        });
        if (existingUserIds.length === 0) {
            throw new Error("None of the specified users are in the conversation.");
        }
        await prisma.conversationUser.deleteMany({
            where: { conversation_id: conversationId, user_id: { in: userIds } },
        });
    }
    async isUserInConversation(conversationId: string, userId: string): Promise<boolean> {
        const existingConversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
        });
        if (!existingConversation) {
            throw new Error("Conversation not found.");
        }
        const userInConversation = await prisma.conversationUser.findUnique({
            where: { conversation_id_user_id: { conversation_id: conversationId, user_id: userId } },
        });
        if (!userInConversation) {
            return false;
        }
        return true;
    }
    async createMessage(input: CreateMessageRepositoryInput): Promise<MessageEntity> {
        const conversation = await prisma.conversation.findUnique({
            where: { id: input.conversationId },
        });
        if (!conversation) {
            throw new Error("Conversation not found.");
        }
        const userInConversation = await prisma.conversationUser.findUnique({
            where: { conversation_id_user_id: { conversation_id: input.conversationId, user_id: input.senderId } },
        });
        if (!userInConversation) {
            throw new Error("Sender is not part of the conversation.");
        }
        const messageRecord = await prisma.message.create({
            data: {
                conversation_id: input.conversationId,
                sender_id: input.senderId,
                content: input.content,
            }
        });
        return MessageEntityMapper.toEntity(messageRecord);
    }
    async createMessageWithMedia(input: CreateMessageWithMediaRepositoryInput): Promise<MessageWithMediaRepositoryResult> {
        return prisma.$transaction(async (tx) => {
            const conversation = await tx.conversation.findUnique({
                where: { id: input.conversationId },
            });
            if (!conversation) {
                throw new Error("Conversation not found.");
            }
            const userInConversation = await tx.conversationUser.findUnique({
                where: {
                    conversation_id_user_id: {
                        conversation_id: input.conversationId, user_id: input.senderId
                    }
                },
            });
            if (!userInConversation) {
                throw new Error("Sender is not part of the conversation.");
            }
            const messageRecord = await tx.message.create({
                data: {
                    conversation_id: input.conversationId,
                    sender_id: input.senderId,
                    content: input.content,
                },
            });
            const mediaRecords = await Promise.all(
                input.media.map((media) =>
                    tx.messageMedia.create({
                        data: {
                            message_id: messageRecord.id,
                            media_url: media.mediaUrl,
                            media_type: media.mediaType,
                            public_id: media.publicId,
                        }
                    })
                )
            );
            return {
                message: MessageEntityMapper.toEntity(messageRecord),
                media: mediaRecords.map((record) => MessageMediaEntityMapper.toEntity(record)),
            };
        });
    }
    async updateMessage(messageId: string, input: UpdateMessageRepositoryInput): Promise<MessageEntity> {
        const existingMessage = await prisma.message.findUnique({
            where: { id: messageId },
        });
        if (!existingMessage) {
            throw new Error("Message not found.");
        }
        const updatedMessage = await prisma.message.update({
            where: { id: messageId },
            data: {
                content: input.content,
            }
        });
        return MessageEntityMapper.toEntity(updatedMessage);
    }

    async deleteMessage(messageId: string): Promise<void> {
        const existingMessage = await prisma.message.findUnique({
            where: { id: messageId },
        });
        if (!existingMessage) {
            throw new Error("Message not found.");
        }
        await prisma.message.update({
            where: { id: messageId },
            data: {
                is_deleted: true,
            }
        });

    }
    async displayMessages(conversationId: string): Promise<MessageWithMediaRepositoryResult[]> {
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
        });
        if (!conversation) {
            throw new Error("Conversation not found.");
        }

        const messageRecords = await prisma.message.findMany({
            where: {
                conversation_id: conversationId,
                is_deleted: false,
            },
            include: {
                media: true,
            },
            orderBy: [{ created_at: "asc" }, { id: "asc" }],
        });
        return messageRecords.map((messageRecord) => ({
            message: MessageEntityMapper.toEntity(messageRecord),
            media: messageRecord.media.map((mediaRecord) => MessageMediaEntityMapper.toEntity(mediaRecord)),
        }));
    }
    async findMessages(query: FindMessagesQuery): Promise<FindMessagesResult> {
        const limit = this.normalizeLimit(query.limit);
        const sortBy = query.sortBy ?? DEFAULT_MESSAGE_SORT_BY;
        const sortOrder = query.sortOrder ?? DEFAULT_MESSAGE_SORTED;
        const direction = query.direction ?? "up";
        const normalizedSearch = query.search.trim();

        const conversation = await prisma.conversation.findUnique({
            where: { id: query.conversationId },
        });
        if (!conversation) {
            throw new Error("Conversation not found.");
        }
        if (normalizedSearch === "") {
            throw new Error("Search query cannot be empty.");
        }

        const messageRecords = await prisma.message.findMany({
            where: {
                conversation_id: query.conversationId,
                content: {
                    contains: normalizedSearch,
                    mode: "insensitive", // Case-insensitive search
                },
                is_deleted: false,
            },
            include: {
                media: true,
            },
            orderBy: this.buildMessageOrderBy(sortBy, sortOrder),
            take: direction === "down" ? -(limit + 1) : limit + 1,
            ...(query.cursor ? {
                cursor: { id: query.cursor },
                skip: 1,
            } : {})
        });

        const orderedRecords = direction === "down"
            ? [...messageRecords].reverse()
            : messageRecords;

        const hasMoreInDirection = orderedRecords.length > limit;
        const pagedMessages = hasMoreInDirection ? orderedRecords.slice(0, limit) : orderedRecords;

        return {
            messages: pagedMessages.map((messageRecord) => ({
                message: MessageEntityMapper.toEntity(messageRecord),
                media: messageRecord.media.map((mediaRecord) => MessageMediaEntityMapper.toEntity(mediaRecord)),
            })),
            nextCursor: pagedMessages.length
                ? pagedMessages[pagedMessages.length - 1].id
                : undefined,
            prevCursor: pagedMessages.length
                ? pagedMessages[0].id
                : undefined,
        };
    }

    // Utility method to build orderBy clause for posts, comments
    private buildConversationOrderBy(sortBy: ConversationSortBy, sortOrder: SortOrder) {
        if (sortBy === "updated_at") {
            return [{ updated_at: sortOrder }, { id: sortOrder }];
        }

        return [{ created_at: sortOrder }, { id: sortOrder }];
    }

    private buildMessageOrderBy(sortBy: MessageSortBy, sortOrder: SortOrder) {
        if (sortBy === "updated_at") {
            return [{ updated_at: sortOrder }, { id: sortOrder }];
        }

        return [{ created_at: sortOrder }, { id: sortOrder }];
    }
    // Utility method to validate and normalize the limit parameter
    private normalizeLimit(limit: number): number {
        if (!Number.isInteger(limit) || limit <= 0) {
            throw new Error("Limit must be a positive integer");
        }

        return limit;
    }

}