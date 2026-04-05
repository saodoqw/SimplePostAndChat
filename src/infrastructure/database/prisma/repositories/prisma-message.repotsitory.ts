import { MessageEntity } from "../../../../domain/entities/message.entity.js";
import { MessageRepository } from "../../../../domain/repositories/message.repository.js";
import { prisma } from "../prismaClient.js";
import { type CreateMessageRepositoryInput, type createMessageWithMediaRepositoryInput } from "../../../../domain/repositories/message.repository.js";
import { type Message as PrismaMessageRecord } from "../generated/client.js";

function messageEntityMapper(record: PrismaMessageRecord): MessageEntity {
    return new MessageEntity({
        id: record.id,
        conversationId: record.conversation_id,
        senderId: record.sender_id,
        content: record.content,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
        isDeleted: record.is_deleted,
    });
}

export class PrismaMessageRepository implements MessageRepository {
    async createMessage(input: CreateMessageRepositoryInput): Promise<MessageEntity> {
        const conversationId = input.conversationId.trim();
        const senderId = input.senderId.trim();
        const content = typeof input.content === "string" ? input.content.trim() : input.content;

        const messageRecord = await prisma.$transaction(async (tx) => {
            const conversation = await tx.conversation.findUnique({
                where: { id: conversationId },
                select: { id: true },
            });
            if (!conversation) {
                throw new Error("Conversation not found.");
            }

            const userInConversation = await tx.conversationUser.findUnique({
                where: {
                    conversation_id_user_id: {
                        conversation_id: conversationId,
                        user_id: senderId,
                    },
                },
                select: { id: true },
            });
            if (!userInConversation) {
                throw new Error("Sender is not part of the conversation.");
            }

            return tx.message.create({
                data: {
                    conversation_id: conversationId,
                    sender_id: senderId,
                    content,
                },
            });
        });

        return messageEntityMapper(messageRecord);
    }

    async createMessageWithMedia(input: createMessageWithMediaRepositoryInput): Promise<MessageEntity> {
        const conversationId = input.conversationId.trim();
        const senderId = input.senderId.trim();
        const content = typeof input.content === "string" ? input.content.trim() : input.content;

        const mediaInputs = input.media.map((media) => ({
            mediaUrl: media.mediaUrl.trim(),
            mediaType: media.mediaType.trim(),
            publicId: media.publicId.trim(),
        }));

        const messageRecord = await prisma.$transaction(async (tx) => {
            const conversation = await tx.conversation.findUnique({
                where: { id: conversationId },
                select: { id: true },
            });
            if (!conversation) {
                throw new Error("Conversation not found.");
            }

            const userInConversation = await tx.conversationUser.findUnique({
                where: {
                    conversation_id_user_id: {
                        conversation_id: conversationId,
                        user_id: senderId,
                    },
                },
                select: { id: true },
            });
            if (!userInConversation) {
                throw new Error("Sender is not part of the conversation.");
            }

            const createdMessage = await tx.message.create({
                data: {
                    conversation_id: conversationId,
                    sender_id: senderId,
                    content,
                },
            });

            if (mediaInputs.length > 0) {
                await tx.messageMedia.createMany({
                    data: mediaInputs.map((media) => ({
                        message_id: createdMessage.id,
                        media_url: media.mediaUrl,
                        media_type: media.mediaType,
                        public_id: media.publicId,
                    })),
                });
            }

            return createdMessage;
        });

        return messageEntityMapper(messageRecord);
    }

    async findMessageById(messageId: string): Promise<MessageEntity | null> {
        const messageRecord = await prisma.message.findUnique({
            where: { id: messageId },
        });

        if (!messageRecord) {
            return null;
        }

        return messageEntityMapper(messageRecord);
    }

    async updateMessage(messageId: string, content: string): Promise<MessageEntity> {
        const normalizedContent = content.trim();

        const messageRecord = await prisma.message.update({
            where: { id: messageId },
            data: { content: normalizedContent },
        });

        return messageEntityMapper(messageRecord);
    }

    async deleteMessage(messageId: string): Promise<void> {
        await prisma.message.update({
            where: { id: messageId },
            data: { is_deleted: true },
        });
    }

}