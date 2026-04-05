import { ConversationMemberRepository } from "../../../../domain/repositories/conversationMember.repository.js";
import { prisma } from "../prismaClient.js";


export class PrismaConservationMemberRepository implements ConversationMemberRepository {
    async addMemberToConversation(conversationId: string, userId: string): Promise<void> {
        const normalizedConversationId = conversationId.trim();
        const normalizedUserId = userId.trim();

        const conversation = await prisma.conversation.findUnique({
            where: { id: normalizedConversationId },
            select: { id: true },
        });
        if (!conversation) {
            throw new Error("Conversation not found.");
        }

        const member = await prisma.conversationUser.findUnique({
            where: {
                conversation_id_user_id: {
                    conversation_id: normalizedConversationId,
                    user_id: normalizedUserId,
                },
            },
            select: { id: true },
        });
        if (member) {
            throw new Error("User is already in the conversation.");
        }

        await prisma.conversationUser.create({
            data: {
                conversation_id: normalizedConversationId,
                user_id: normalizedUserId,
                is_admin: false,
            },
        });
    }

    async removeMemberFromConversation(conversationId: string, userId: string): Promise<void> {
        const normalizedConversationId = conversationId.trim();
        const normalizedUserId = userId.trim();

        const conversation = await prisma.conversation.findUnique({
            where: { id: normalizedConversationId },
            select: { id: true },
        });
        if (!conversation) {
            throw new Error("Conversation not found.");
        }

        const member = await prisma.conversationUser.findUnique({
            where: {
                conversation_id_user_id: {
                    conversation_id: normalizedConversationId,
                    user_id: normalizedUserId,
                },
            },
            select: { id: true },
        });
        if (!member) {
            throw new Error("User is not in the conversation.");
        }

        await prisma.conversationUser.delete({
            where: {
                conversation_id_user_id: {
                    conversation_id: normalizedConversationId,
                    user_id: normalizedUserId,
                },
            },
        });
    }

    async isUserInConversation(conversationId: string, userId: string): Promise<boolean> {
        const normalizedConversationId = conversationId.trim();
        const normalizedUserId = userId.trim();

        const member = await prisma.conversationUser.findUnique({
            where: {
                conversation_id_user_id: {
                    conversation_id: normalizedConversationId,
                    user_id: normalizedUserId,
                },
            },
            select: { id: true },
        });

        return Boolean(member);
    }

    async leaveConversation(conversationId: string, userId: string): Promise<void> {
        await this.removeMemberFromConversation(conversationId, userId);
    }

    async isAdmin(conversationId: string, userId: string): Promise<boolean> {
        const normalizedConversationId = conversationId.trim();
        const normalizedUserId = userId.trim();

        const member = await prisma.conversationUser.findUnique({
            where: {
                conversation_id_user_id: {
                    conversation_id: normalizedConversationId,
                    user_id: normalizedUserId,
                },
            },
            select: { is_admin: true },
        });

        if (!member) {
            throw new Error("User is not in the conversation.");
        }

        return member.is_admin;
    }

    async transferAdmin(conversationId: string, fromUserId: string, toUserId: string): Promise<void> {
        const normalizedConversationId = conversationId.trim();
        const normalizedFromUserId = fromUserId.trim();
        const normalizedToUserId = toUserId.trim();

        await prisma.$transaction(async (tx) => {
            const conversation = await tx.conversation.findUnique({
                where: { id: normalizedConversationId },
                select: { id: true },
            });
            if (!conversation) {
                throw new Error("Conversation not found.");
            }

            const fromMember = await tx.conversationUser.findUnique({
                where: {
                    conversation_id_user_id: {
                        conversation_id: normalizedConversationId,
                        user_id: normalizedFromUserId,
                    },
                },
                select: { id: true, is_admin: true },
            });
            if (!fromMember) {
                throw new Error("Current admin is not in the conversation.");
            }
            if (!fromMember.is_admin) {
                throw new Error("Only admin can transfer admin role.");
            }

            const toMember = await tx.conversationUser.findUnique({
                where: {
                    conversation_id_user_id: {
                        conversation_id: normalizedConversationId,
                        user_id: normalizedToUserId,
                    },
                },
                select: { id: true },
            });
            if (!toMember) {
                throw new Error("New admin is not in the conversation.");
            }

            await tx.conversationUser.update({
                where: {
                    conversation_id_user_id: {
                        conversation_id: normalizedConversationId,
                        user_id: normalizedToUserId,
                    },
                },
                data: { is_admin: true },
            });

            await tx.conversationUser.update({
                where: {
                    conversation_id_user_id: {
                        conversation_id: normalizedConversationId,
                        user_id: normalizedFromUserId,
                    },
                },
                data: { is_admin: false },
            });
        });
    }
}