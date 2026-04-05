import { ConversationEntity } from "../../../../domain/entities/conversation.entity.js";
import { ConservationRepository, ConversationWithUsersRepositoryResult, CreateConversationRepositoryInput, UpdateConversationRepositoryInput } from "../../../../domain/repositories/conservation.repository.js";
import { prisma } from "../prismaClient.js";
import { type Conversation as PrismaConversationRecord } from "../generated/client.js";

function conversationEntityMapper(record: PrismaConversationRecord): ConversationEntity {
    return new ConversationEntity({
        id: record.id,
        name: record.name,
        isGroup: record.is_group,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
    });
}

function normalizeAndDeduplicateUserIds(userIds: string[]): string[] {
    const normalized = userIds.map((userId) => userId.trim()).filter(Boolean);
    return Array.from(new Set(normalized));
}

export class PrismaConservationRepository implements ConservationRepository {
    async createConversation(input: CreateConversationRepositoryInput): Promise<ConversationEntity> {
        const userIds = normalizeAndDeduplicateUserIds(input.userIds);
        if (!userIds.length) {
            throw new Error("At least one user is required to create a conversation");
        }

        const creatorUserId = input.creatorUserId?.trim();
        if (input.isGroup && creatorUserId && !userIds.includes(creatorUserId)) {
            throw new Error("creatorUserId must be included in userIds");
        }

        const conversation = await prisma.$transaction(async (tx) => {
            const createdConversation = await tx.conversation.create({
                data: {
                    name: input.name.trim(),
                    is_group: input.isGroup ?? false,
                },
            });

            await tx.conversationUser.createMany({
                data: userIds.map((userId) => ({
                    conversation_id: createdConversation.id,
                    user_id: userId,
                    is_admin: input.isGroup && creatorUserId === userId,
                })),
            });

            return createdConversation;
        });

        return conversationEntityMapper(conversation);
    }

    async updateConversation(conversationId: string, input: UpdateConversationRepositoryInput): Promise<ConversationEntity> {
        const data: { name?: string } = {};
        if (typeof input.name === "string") {
            const normalizedName = input.name.trim();
            data.name = normalizedName;
        }

        const conversation = await prisma.conversation.update({
            where: { id: conversationId },
            data,
        });

        return conversationEntityMapper(conversation);
    }

    async deleteConversation(conversationId: string): Promise<void> {
        await prisma.conversation.delete({
            where: { id: conversationId },
        });
    }

    async findConversationById(conversationId: string): Promise<ConversationEntity | null> {
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
        });

        if (!conversation) {
            return null;
        }

        return conversationEntityMapper(conversation);
    }

    async findDirectConversation(userId1: string, userId2: string): Promise<ConversationWithUsersRepositoryResult | null> {
        const normalizedUserId1 = userId1.trim();
        const normalizedUserId2 = userId2.trim();

        const conversation = await prisma.conversation.findFirst({
            where: {
                is_group: false,
                AND: [
                    { conversationUsers: { some: { user_id: normalizedUserId1 } } },
                    { conversationUsers: { some: { user_id: normalizedUserId2 } } },
                ],
            },
            include: {
                conversationUsers: true,
            },
            orderBy: [
                { updated_at: "desc" },
                { created_at: "desc" },
            ],
        });

        if (!conversation) {
            return null;
        }

        const participantIds = conversation.conversationUsers.map((member) => member.user_id);
        const uniqueParticipantIds = new Set(participantIds);

        if (uniqueParticipantIds.size !== 2) {
            return null;
        }

        return {
            conversation: conversationEntityMapper(conversation),
            users: conversation.conversationUsers.map((member) => ({
                id: member.id,
                userId: member.user_id,
                conversationId: member.conversation_id,
                admin: member.is_admin,
                createdAt: member.created_at,
            })),
        };
    }
}