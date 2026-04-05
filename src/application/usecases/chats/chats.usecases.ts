import {
    type ConversationQueryService,
    type FindConversationsResult,
    type ConversationWithUsersRepositoryResult as ConversationWithUsersDto,
} from "../../queries/conservation.query.js";
import {
    type FindMessagesResult,
    type MessageQueryService,
} from "../../queries/message.query.js";
import {
    type ConservationRepository,
    type CreateConversationRepositoryInput,
} from "../../../domain/repositories/conservation.repository.js";
import { type ConversationMemberRepository } from "../../../domain/repositories/conversationMember.repository.js";
import { type MessageRepository } from "../../../domain/repositories/message.repository.js";
import { type UserRepository } from "../../../domain/repositories/user.repository.js";
import { type MessageEntity } from "../../../domain/entities/message.entity.js";
import { type ImageStorageService } from "../../ports/image-storage.service.js";

const DEFAULT_DIRECT_CHAT_NAME = "Direct Chat";
const DEFAULT_GROUP_CHAT_NAME = "New Group";

type UploadableMediaType = "image" | "video";

export class ConservationUseCase {
    constructor(
        private readonly conservationRepository: ConservationRepository,
        private readonly conversationMemberRepository: ConversationMemberRepository,
        private readonly messageRepository: MessageRepository,
        private readonly conservationQueryService: ConversationQueryService,
        private readonly messageQueryService: MessageQueryService,
        private readonly cloudinaryService: ImageStorageService,
        private readonly userRepository: UserRepository,
    ) { }

    async createGroupChat(userId: string, participantIds: string[], groupName?: string) {
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

        if (normalizedParticipantIds.length <= 1) {
            throw new Error("Use findOrCreateDirectConversation for direct chats");
        }

        const input: CreateConversationRepositoryInput = {
            name: this.normalizeGroupName(groupName),
            userIds: allParticipantIds,
            isGroup: true,
            creatorUserId: normalizedUserId,
        };

        return this.conservationRepository.createConversation(input);
    }

    async findOrCreateDirectConversation(userId: string, recipientId: string) {
        const normalizedUserId = userId.trim();
        if (!normalizedUserId) {
            throw new Error("User ID is required");
        }

        const normalizedRecipientId = recipientId.trim();
        if (!normalizedRecipientId) {
            throw new Error("Recipient ID is required");
        }

        if (normalizedUserId === normalizedRecipientId) {
            throw new Error("Cannot create direct conversation with yourself");
        }

        await this.ensureUsersExist([normalizedUserId, normalizedRecipientId]);

        const existingConversation = await this.conservationRepository.findDirectConversation(
            normalizedUserId,
            normalizedRecipientId,
        );
        if (existingConversation) {
            return existingConversation;
        }

        return this.conservationRepository.createConversation({
            name: DEFAULT_DIRECT_CHAT_NAME,
            userIds: [normalizedUserId, normalizedRecipientId],
            isGroup: false,
        });
    }

    async updateGroupName(conversationId: string, requesterUserId: string, newName: string) {
        const normalizedConversationId = conversationId.trim();
        if (!normalizedConversationId) {
            throw new Error("Conversation ID is required");
        }

        await this.ensureRequesterIsGroupAdmin(normalizedConversationId, requesterUserId);

        const normalizedNewName = newName.trim();
        if (!normalizedNewName) {
            throw new Error("New group name is required");
        }

        return this.conservationRepository.updateConversation(normalizedConversationId, {
            name: normalizedNewName,
        });
    }

    async deleteConversation(conversationId: string, requesterUserId: string) {
        const normalizedConversationId = conversationId.trim();
        if (!normalizedConversationId) {
            throw new Error("Conversation ID is required");
        }

        await this.ensureRequesterIsGroupAdmin(normalizedConversationId, requesterUserId);
        await this.conservationRepository.deleteConversation(normalizedConversationId);
    }

    async listUserConversations(userId: string, limit: number, cursor?: string): Promise<FindConversationsResult> {
        const normalizedUserId = userId.trim();
        if (!normalizedUserId) {
            throw new Error("User ID is required");
        }

        if (!Number.isInteger(limit) || limit <= 0) {
            throw new Error("Limit must be greater than 0");
        }

        return this.conservationQueryService.findConversations({
            userId: normalizedUserId,
            limit,
            cursor,
            sortBy: "updated_at",
            sortOrder: "desc",
        });
    }

    async displayConversationDetails(
        conversationId: string,
        requesterUserId: string,
    ): Promise<ConversationWithUsersDto> {
        const normalizedConversationId = conversationId.trim();
        if (!normalizedConversationId) {
            throw new Error("Conversation ID is required");
        }

        const conversation = await this.conservationQueryService.getConversationById(normalizedConversationId);
        if (!conversation) {
            throw new Error("Conversation not found");
        }

        const normalizedRequesterUserId = requesterUserId.trim();
        const isMember = conversation.users.some((user) => user.id === normalizedRequesterUserId);
        if (!isMember) {
            throw new Error("Forbidden: user is not in conversation");
        }

        return conversation;
    }

    async addParticipants(conversationId: string, requesterUserId: string, participantIds: string[]) {
        const normalizedConversationId = conversationId.trim();
        if (!normalizedConversationId) {
            throw new Error("Conversation ID is required");
        }

        const normalizedParticipantIds = this.normalizeParticipantIds(participantIds);
        if (!normalizedParticipantIds.length) {
            throw new Error("At least one participant ID is required");
        }

        await this.ensureRequesterIsGroupAdmin(normalizedConversationId, requesterUserId);
        await this.ensureUsersExist(normalizedParticipantIds);

        for (const participantId of normalizedParticipantIds) {
            const isMember = await this.conversationMemberRepository.isUserInConversation(
                normalizedConversationId,
                participantId,
            );
            if (isMember) {
                throw new Error(`The following users are already participants in the conversation: ${participantId}`);
            }
        }

        await Promise.all(
            normalizedParticipantIds.map((participantId) =>
                this.conversationMemberRepository.addMemberToConversation(
                    normalizedConversationId,
                    participantId,
                    false,
                ),
            ),
        );
    }

    async removeParticipants(conversationId: string, requesterUserId: string, participantIds: string[]) {
        const normalizedConversationId = conversationId.trim();
        if (!normalizedConversationId) {
            throw new Error("Conversation ID is required");
        }

        await this.ensureRequesterIsGroupAdmin(normalizedConversationId, requesterUserId);

        const normalizedParticipantIds = this.normalizeParticipantIds(participantIds);
        if (!normalizedParticipantIds.length) {
            throw new Error("At least one participant ID is required");
        }

        await this.ensureUsersExist(normalizedParticipantIds);

        for (const participantId of normalizedParticipantIds) {
            const isMember = await this.conversationMemberRepository.isUserInConversation(
                normalizedConversationId,
                participantId,
            );
            if (!isMember) {
                throw new Error(`The following users are not participants in the conversation: ${participantId}`);
            }
        }

        await Promise.all(
            normalizedParticipantIds.map((participantId) =>
                this.conversationMemberRepository.removeMemberFromConversation(
                    normalizedConversationId,
                    participantId,
                ),
            ),
        );
    }

    async isUserInConversation(conversationId: string, userId: string): Promise<boolean> {
        const normalizedConversationId = conversationId.trim();
        if (!normalizedConversationId) {
            throw new Error("Conversation ID is required");
        }

        const normalizedUserId = userId.trim();
        if (!normalizedUserId) {
            throw new Error("User ID is required");
        }

        return this.conversationMemberRepository.isUserInConversation(normalizedConversationId, normalizedUserId);
    }

    async leaveConversation(conversationId: string, userId: string): Promise<void> {
        const normalizedConversationId = conversationId.trim();
        if (!normalizedConversationId) {
            throw new Error("Conversation ID is required");
        }

        const normalizedUserId = userId.trim();
        if (!normalizedUserId) {
            throw new Error("User ID is required");
        }

        const isMember = await this.conversationMemberRepository.isUserInConversation(
            normalizedConversationId,
            normalizedUserId,
        );
        if (!isMember) {
            throw new Error("Forbidden: user is not in conversation");
        }

        const isAdmin = await this.conversationMemberRepository.isAdmin(normalizedConversationId, normalizedUserId);
        if (isAdmin) {
            throw new Error("Group admins cannot leave the conversation. Please transfer admin role before leaving.");
        }

        await this.conversationMemberRepository.leaveConversation(normalizedConversationId, normalizedUserId);
    }

    async transferGroupAdmin(conversationId: string, requesterUserId: string, newAdminUserId: string): Promise<void> {
        const normalizedConversationId = conversationId.trim();
        if (!normalizedConversationId) {
            throw new Error("Conversation ID is required");
        }

        const normalizedRequesterUserId = requesterUserId.trim();
        if (!normalizedRequesterUserId) {
            throw new Error("Requester ID is required");
        }

        const normalizedNewAdminUserId = newAdminUserId.trim();
        if (!normalizedNewAdminUserId) {
            throw new Error("New admin ID is required");
        }

        await this.ensureRequesterIsGroupAdmin(normalizedConversationId, normalizedRequesterUserId);

        const isNewAdminMember = await this.conversationMemberRepository.isUserInConversation(
            normalizedConversationId,
            normalizedNewAdminUserId,
        );
        if (!isNewAdminMember) {
            throw new Error("New admin user must be a member of the conversation");
        }

        await this.conversationMemberRepository.transferAdmin(
            normalizedConversationId,
            normalizedRequesterUserId,
            normalizedNewAdminUserId,
        );
    }

    async sendMessage(
        conversationId: string,
        senderId: string,
        content?: string,
        mediaFiles?: { buffer: Buffer; filename: string; mimetype: string }[],
    ): Promise<MessageEntity> {
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
                }),
            );

            return this.messageRepository.createMessageWithMedia({
                conversationId: normalizedConversationId,
                senderId: normalizedSenderId,
                content: normalizedContent || null,
                media: mediaUploadResults,
            });
        }

        return this.messageRepository.createMessage({
            conversationId: normalizedConversationId,
            senderId: normalizedSenderId,
            content: normalizedContent || null,
        });
    }

    async updateMessage(conversationId: string, userId: string, messageId: string, content: string) {
        const normalizedConversationId = conversationId.trim();
        const normalizedUserId = userId.trim();
        const normalizedMessageId = messageId.trim();
        const normalizedContent = content.trim();

        if (!normalizedConversationId) {
            throw new Error("Conversation ID is required");
        }
        if (!normalizedUserId) {
            throw new Error("User ID is required");
        }
        if (!normalizedMessageId) {
            throw new Error("Message ID is required");
        }
        if (!normalizedContent) {
            throw new Error("Message content is required");
        }

        const isMember = await this.conversationMemberRepository.isUserInConversation(
            normalizedConversationId,
            normalizedUserId,
        );
        if (!isMember) {
            throw new Error("Forbidden: user is not in conversation");
        }

        const existingMessage = await this.messageRepository.findMessageById(normalizedMessageId);
        if (!existingMessage || existingMessage.isDeleted) {
            throw new Error("Message not found");
        }
        if (existingMessage.conversationId !== normalizedConversationId) {
            throw new Error("Message does not belong to this conversation");
        }
        if (existingMessage.senderId !== normalizedUserId) {
            throw new Error("Forbidden: only message owner can update this message");
        }
        if (existingMessage.createdAt.getTime() + 5 * 60 * 1000 < Date.now()) {
            throw new Error("Forbidden: messages can only be edited within 5 minutes of sending");
        }

        return this.messageRepository.updateMessage(normalizedMessageId, normalizedContent);
    }

    async deleteMessage(conversationId: string, userId: string, messageId: string): Promise<void> {
        const normalizedConversationId = conversationId.trim();
        const normalizedUserId = userId.trim();
        const normalizedMessageId = messageId.trim();

        if (!normalizedConversationId) {
            throw new Error("Conversation ID is required");
        }
        if (!normalizedUserId) {
            throw new Error("User ID is required");
        }
        if (!normalizedMessageId) {
            throw new Error("Message ID is required");
        }

        const isMember = await this.conversationMemberRepository.isUserInConversation(
            normalizedConversationId,
            normalizedUserId,
        );
        if (!isMember) {
            throw new Error("Forbidden: user is not in conversation");
        }

        const existingMessage = await this.messageRepository.findMessageById(normalizedMessageId);
        if (!existingMessage || existingMessage.isDeleted) {
            throw new Error("Message not found");
        }
        if (existingMessage.conversationId !== normalizedConversationId) {
            throw new Error("Message does not belong to this conversation");
        }
        if (existingMessage.senderId !== normalizedUserId) {
            throw new Error("Forbidden: only message owner can delete this message");
        }

        await this.messageRepository.deleteMessage(normalizedMessageId);
    }

    async paginateMessages(
        conversationId: string,
        limit: number,
        cursor?: string,
        search?: string,
        direction?: "up" | "down",
    ): Promise<FindMessagesResult> {
        const normalizedConversationId = conversationId.trim();
        if (!normalizedConversationId) {
            throw new Error("Conversation ID is required");
        }
        if (limit <= 0) {
            throw new Error("Limit must be greater than 0");
        }

        return this.messageQueryService.findMessages({
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

    private async ensureRequesterIsGroupAdmin(conversationId: string, requesterUserId: string): Promise<void> {
        const normalizedRequesterUserId = requesterUserId.trim();
        if (!normalizedRequesterUserId) {
            throw new Error("Requester user ID is required");
        }

        const conversation = await this.conservationRepository.findConversationById(conversationId);
        if (!conversation) {
            throw new Error("Conversation not found");
        }
        if (!conversation.isGroup) {
            throw new Error("Only group conversations support this action");
        }

        const isAdmin = await this.conversationMemberRepository.isAdmin(
            conversationId,
            normalizedRequesterUserId,
        );
        if (!isAdmin) {
            throw new Error("Forbidden: admin permission is required");
        }
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

export { ConservationUseCase as ChatUseCase };