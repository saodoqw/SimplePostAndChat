import {
    type ChatRepository,
    type CreateConversationRepositoryInput,
} from "../../domain/repositories/chat.repository.js";
import { type UserRepository } from "../../domain/repositories/user.repository.js";
import { type CloudinaryService } from '../../infrastructure/imageStorage/cloudinary/cloudinary.service.js';

const DEFAULT_DIRECT_CHAT_NAME = "Direct Chat";
const DEFAULT_GROUP_CHAT_NAME = "New Group";
type UploadableMediaType = "image" | "video";


export class ChatUseCase {
    constructor(
        private readonly chatRepository: ChatRepository,
        private readonly cloudinaryService: CloudinaryService,
        private readonly userRepository: UserRepository,
    ) { }

    async createChat(userId: string, participantIds: string[], groupName?: string) {
        const normalizedUserId = userId.trim();
        if (!normalizedUserId) {
            throw new Error("User ID is required");
        }

        const normalizedParticipantIds = this.normalizeParticipantIds(participantIds);
        if (!normalizedParticipantIds.length) {
            throw new Error("At least one participant ID is required");
        }

        if (normalizedParticipantIds.includes(normalizedUserId)) {
            throw new Error("participantIds must not include current userId");
        }

        const allParticipantIds = [normalizedUserId, ...normalizedParticipantIds];
        await this.ensureUsersExist(allParticipantIds);

        const isGroup = normalizedParticipantIds.length > 1;
        const input: CreateConversationRepositoryInput = {
            name: isGroup
                ? this.normalizeGroupName(groupName)
                : DEFAULT_DIRECT_CHAT_NAME,
            userIds: allParticipantIds,
            isGroup,
            ...(isGroup ? { creatorUserId: normalizedUserId } : {}),
        };

        return this.chatRepository.createConversation(input);
    }
    async updateGroupName(conversationId: string, newName: string) {
        const normalizedConversationId = conversationId.trim();
        if (!normalizedConversationId) {
            throw new Error("Conversation ID is required");
        }
        const normalizedNewName = newName.trim();
        if (!normalizedNewName) {
            throw new Error("New group name is required");
        }

        return this.chatRepository.updateConversation(normalizedConversationId, { name: normalizedNewName });
    }
    async deleteConversation(conversationId: string) {
        const normalizedConversationId = conversationId.trim();
        if (!normalizedConversationId) {
            throw new Error("Conversation ID is required");
        }
        return this.chatRepository.deleteConversation(normalizedConversationId);
    }

    async listUserConversations(userId: string, limit: number, cursor?: string) {
        const normalizedUserId = userId.trim();
        if (!normalizedUserId) {
            throw new Error("User ID is required");
        }
        if (limit <= 0) {
            throw new Error("Limit must be greater than 0");
        }
        return this.chatRepository.findConversations({
            userId: normalizedUserId,
            limit,
            cursor,
            sortBy: "updated_at",
            sortOrder: "desc",
        });
    }
    async displayConversationDetails(conversationId: string) {
        const normalizedConversationId = conversationId.trim();
        if (!normalizedConversationId) {
            throw new Error("Conversation ID is required");
        }
        const conversationWithUsers = await this.chatRepository.findConversationWithUsers(normalizedConversationId);
        if (!conversationWithUsers) {
            throw new Error("Conversation not found");
        }
        return conversationWithUsers;
    }

    async addParticipants(conversationId: string, participantIds: string[]) {
        const normalizedConversationId = conversationId.trim();
        if (!normalizedConversationId) {
            throw new Error("Conversation ID is required");
        }
        const normalizedParticipantIds = this.normalizeParticipantIds(participantIds);
        if (!normalizedParticipantIds.length) {
            throw new Error("At least one participant ID is required");
        }
        await this.ensureUsersExist(normalizedParticipantIds);
        return this.chatRepository.addUsersToConversation(normalizedConversationId, normalizedParticipantIds);
    }
    async removeParticipants(conversationId: string, participantIds: string[]) {
        const normalizedConversationId = conversationId.trim();
        if (!normalizedConversationId) {
            throw new Error("Conversation ID is required");
        }
        const normalizedParticipantIds = this.normalizeParticipantIds(participantIds);
        if (!normalizedParticipantIds.length) {
            throw new Error("At least one participant ID is required");
        }
        return this.chatRepository.removeUsersFromConversation(normalizedConversationId, normalizedParticipantIds);
    }

    async isUserInConversation(conversationId: string, userId: string) {
        const normalizedConversationId = conversationId.trim();
        if (!normalizedConversationId) {
            throw new Error("Conversation ID is required");
        }
        const normalizedUserId = userId.trim();
        if (!normalizedUserId) {
            throw new Error("User ID is required");
        }
        return this.chatRepository.isUserInConversation(normalizedConversationId, normalizedUserId);
    }

    async sendMessage(
        conversationId: string,
        senderId: string,
        content?: string,
        mediaFiles?: { buffer: Buffer; filename: string; mimetype: string }[]
    ) {
        const normalizedConversationId = conversationId.trim();
        if (!normalizedConversationId) {
            throw new Error("Conversation ID is required");
        }
        const normalizedSenderId = senderId.trim();
        if (!normalizedSenderId) {
            throw new Error("Sender ID is required");
        }
        const normalizedContent = content?.trim();
        const hasMediaFiles = Boolean(mediaFiles?.length);

        if (!normalizedContent && !hasMediaFiles) {
            throw new Error("Message content or media is required");
        }

        if (mediaFiles && mediaFiles.length > 0) {
            const mediaUploadResults = await Promise.all(
                mediaFiles.map(async (file) => {
                    const mediaType = this.resolveMediaTypeFromMimeType(file.mimetype);
                    const uploadResult = mediaType === "video"
                        ? await this.cloudinaryService.uploadVideo(file.buffer, "message_media")
                        : await this.cloudinaryService.uploadImage(file.buffer, "message_media");

                    return {

                        mediaUrl: uploadResult.url,
                        mediaType,
                        publicId: uploadResult.publicId,
                    };
                })
            );

            return this.chatRepository.createMessageWithMedia({
                conversationId: normalizedConversationId,
                senderId: normalizedSenderId,
                content: normalizedContent || null,
                media: mediaUploadResults,
            });
        }

        return this.chatRepository.createMessage({
            conversationId: normalizedConversationId,
            senderId: normalizedSenderId,
            content: normalizedContent || null,
        });
    }
    async updateMessage(messageId: string, content: string) {
        const normalizedMessageId = messageId.trim();
        if (!normalizedMessageId) {
            throw new Error("Message ID is required");
        }
        const normalizedContent = content.trim();
        if (!normalizedContent) {
            throw new Error("Message content is required");
        }
        return this.chatRepository.updateMessage(normalizedMessageId, { content: normalizedContent });
    }

    async deleteMessage(messageId: string) {
        const normalizedMessageId = messageId.trim();
        if (!normalizedMessageId) {
            throw new Error("Message ID is required");
        }
        return this.chatRepository.deleteMessage(normalizedMessageId);
    }
    async displayMessages(conversationId: string) {
        const normalizedConversationId = conversationId.trim();
        if (!normalizedConversationId) {
            throw new Error("Conversation ID is required");
        }
        return this.chatRepository.displayMessages(normalizedConversationId);
    }
    async paginateMessages(conversationId: string, limit: number, cursor?: string, search?: string, direction?: "up" | "down") {
        const normalizedConversationId = conversationId.trim();
        if (!normalizedConversationId) {
            throw new Error("Conversation ID is required");
        }
        if (limit <= 0) {
            throw new Error("Limit must be greater than 0");
        }
        return this.chatRepository.findMessages({
            conversationId: normalizedConversationId,
            limit,
            cursor,
            search,
            direction: direction ?? "up",
            sortBy: "created_at",
            sortOrder: "desc",
        });
    }

    private resolveMediaTypeFromMimeType(mimetype: string): UploadableMediaType {
        const normalizedMimeType = mimetype.trim().toLowerCase();

        if (normalizedMimeType.startsWith("image/")) {
            return "image";
        }
        if (normalizedMimeType.startsWith("video/")) {
            return "video";
        }

        throw new Error(`Unsupported media type: ${mimetype}`);
    }

    private normalizeParticipantIds(participantIds: string[]): string[] {
        const normalizedParticipantIds = participantIds
            .map((participantId) => participantId.trim())
            .filter((participantId) => participantId.length > 0);

        const uniqueParticipantIds = [...new Set(normalizedParticipantIds)];
        if (uniqueParticipantIds.length !== normalizedParticipantIds.length) {
            throw new Error("Duplicate participant IDs are not allowed");
        }

        return uniqueParticipantIds;
    }

    private normalizeGroupName(groupName?: string): string {
        const normalizedName = groupName?.trim();
        if (!normalizedName) {
            return DEFAULT_GROUP_CHAT_NAME;
        }

        return normalizedName;
    }

    private async ensureUsersExist(userIds: string[]): Promise<void> {
        for (const userId of userIds) {
            const existingUser = await this.userRepository.findById(userId);
            if (!existingUser) {
                throw new Error(`User not found: ${userId}`);
            }
        }
    }
}