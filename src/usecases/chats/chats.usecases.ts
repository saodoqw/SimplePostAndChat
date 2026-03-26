import { fail } from "node:assert";
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

        const isGroup = normalizedParticipantIds.length > 1;
        if (!isGroup) {
            throw new Error("Use findOrCreateDirectConversation for direct chats");
        }
        const input: CreateConversationRepositoryInput = {
            name: isGroup
                ? this.normalizeGroupName(groupName)
                : DEFAULT_DIRECT_CHAT_NAME,
            userIds: allParticipantIds,
            isGroup,
            creatorUserId: normalizedUserId,
        };

        return this.chatRepository.createConversation(input);
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

        // Try to find existing direct conversation, otherwise create new one
        const existingConversation = await this.chatRepository.findDirectConversation(normalizedUserId, normalizedRecipientId);
        if (existingConversation) {
            return existingConversation;
        }

        const input: CreateConversationRepositoryInput = {
            name: DEFAULT_DIRECT_CHAT_NAME,
            userIds: [normalizedUserId, normalizedRecipientId],
            isGroup: false,
        };

        return this.chatRepository.createConversation(input);
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

        return this.chatRepository.updateConversation(normalizedConversationId, { name: normalizedNewName });
    }
    async deleteConversation(conversationId: string, requesterUserId: string) {
        const normalizedConversationId = conversationId.trim();
        if (!normalizedConversationId) {
            throw new Error("Conversation ID is required");
        }
        await this.ensureRequesterIsGroupAdmin(normalizedConversationId, requesterUserId);
        await this.deleteImagesInConversation(normalizedConversationId);
        return this.chatRepository.deleteConversation(normalizedConversationId);
    }

    private async deleteImagesInConversation(conversationId: string): Promise<void> {
        const messagesWithMedia = await this.chatRepository.getAllMessagesWithMedia(conversationId);

        if (!messagesWithMedia.length) {
            return;
        }
        const assetMap = new Map();
        for (const asset of messagesWithMedia) {
            const key = `${asset.mediaType}:${asset.publicId}`;
            if (!assetMap.has(key)) {
                assetMap.set(key, asset);
            }
        }
        const uniqueAssets = Array.from(assetMap.values());

        const deleteResults = await Promise.allSettled(
            uniqueAssets.map((asset) =>
                asset.mediaType === "video"
                    ? this.cloudinaryService.deleteVideo(asset.publicId)
                    : this.cloudinaryService.deleteImage(asset.publicId)
            )
        );
        const failedDeletes = deleteResults
            .map((result, index) => ({ result, asset: uniqueAssets[index] }))
            .filter((entry) => entry.result.status === "rejected");

        if (failedDeletes.length) {
            console.error("Failed to delete some cloud assets after user deletion", {
                failedAssets: failedDeletes.map((entry) => entry.asset.publicId),
            });
        }
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
    async displayConversationDetails(conversationId: string, requesterUserId: string) {
        const normalizedConversationId = conversationId.trim();
        if (!normalizedConversationId) {
            throw new Error("Conversation ID is required");
        }
        const conversationWithUsers = await this.chatRepository.findConversationWithUsers(normalizedConversationId);
        if (!conversationWithUsers) {
            throw new Error("Conversation not found");
        }
        if (!conversationWithUsers.users.some((user) => user.userId === requesterUserId)) {
            throw new Error("Forbidden: user is not in conversation");
        }
        return conversationWithUsers;
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
        await this.ensureNotAddingExistingParticipants(normalizedConversationId, participantIds);
        return this.chatRepository.addUsersToConversation(normalizedConversationId, normalizedParticipantIds);
    }

    private ensureNotAddingExistingParticipants(conversationId: string, participantIds: string[]) {
        const existingParticipantsPromise = this.chatRepository.findConversationWithUsers(conversationId)
            .then((conversationWithUsers) => conversationWithUsers.users.map((user) => user.userId));
        const normalizedParticipantIds = this.normalizeParticipantIds(participantIds);
        const duplicateCheckPromise = existingParticipantsPromise.then((existingParticipantIds) => {
            const duplicates = normalizedParticipantIds.filter((id) => existingParticipantIds.includes(id));
            if (duplicates.length) {
                throw new Error(`The following users are already participants in the conversation: ${duplicates.join(", ")}`);
            }
        });
        return duplicateCheckPromise;
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
        await this.ensureNotRemovingNonParticipants(normalizedConversationId, normalizedParticipantIds);
        return this.chatRepository.removeUsersFromConversation(normalizedConversationId, normalizedParticipantIds);
    }
    private ensureNotRemovingNonParticipants(conservationId: string, participantIds: string[]) {
        const existingParticipantsPromise = this.chatRepository.findConversationWithUsers(conservationId)
            .then((conversationWithUsers) => conversationWithUsers.users.map((user) => user.userId));
        const normalizedParticipantIds = this.normalizeParticipantIds(participantIds);
        const nonParticipantCheckPromise = existingParticipantsPromise.then((existingParticipantIds) => {
            const nonParticipants = normalizedParticipantIds.filter((id) => !existingParticipantIds.includes(id));
            if (nonParticipants.length) {
                throw new Error(`The following users are not participants in the conversation: ${nonParticipants.join(", ")}`);
            }
        });
        return nonParticipantCheckPromise;
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
    async leaveConversation(conversationId: string, userId: string) {
        const normalizedConversationId = conversationId.trim();
        if (!normalizedConversationId) {
            throw new Error("Conversation ID is required");
        }
        const normalizedUserId = userId.trim();
        if (!normalizedUserId) {
            throw new Error("User ID is required");
        }
        const isMember = await this.chatRepository.isUserInConversation(normalizedConversationId, normalizedUserId);
        if (!isMember) {
            throw new Error("Forbidden: user is not in conversation");
        }
        const isAdmin = await this.chatRepository.isAdmin(normalizedConversationId, normalizedUserId);
        if (isAdmin) {
            throw new Error("Group admins cannot leave the conversation. Please transfer admin role before leaving.");
        }
        return this.chatRepository.leaveConversation(normalizedConversationId, normalizedUserId);
    }
    async transferGroupAdmin(conversationId: string, requesterUserId: string, newAdminUserId: string) {
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
        const conversationWithUsers = await this.chatRepository.findConversationWithUsers(normalizedConversationId);
        if (!conversationWithUsers.users.some((user) => user.userId === normalizedNewAdminUserId)) {
            throw new Error("New admin user must be a member of the conversation");
        }
        await this.chatRepository.transferAdmin(
            normalizedConversationId,
            normalizedRequesterUserId,
            normalizedNewAdminUserId,
        );
        return;
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
    async updateMessage(conversationId: string, userId: string, messageId: string, content: string) {
        const normalizedMessageId = messageId.trim();
        const normalizedConversationId = conversationId.trim();
        const normalizedUserId = userId.trim();
        const isMember = await this.chatRepository.isUserInConversation(normalizedConversationId, normalizedUserId);
        if (!isMember) {
            throw new Error("Forbidden: user is not in conversation");
        }
        if (!normalizedMessageId) {
            throw new Error("Message ID is required");
        }
        const normalizedContent = content.trim();
        if (!normalizedContent) {
            throw new Error("Message content is required");
        }

        const existingMessage = await this.chatRepository.findMessageById(normalizedMessageId);
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

        return this.chatRepository.updateMessage(normalizedMessageId, { content: normalizedContent });
    }

    async deleteMessage(conversationId: string, userId: string, messageId: string) {
        const normalizedMessageId = messageId.trim();
        const normalizedConversationId = conversationId.trim();
        const normalizedUserId = userId.trim();
        const isMember = await this.chatRepository.isUserInConversation(normalizedConversationId, normalizedUserId);
        if (!isMember) {
            throw new Error("Forbidden: user is not in conversation");
        }
        if (!normalizedMessageId) {
            throw new Error("Message ID is required");
        }

        const existingMessage = await this.chatRepository.findMessageById(normalizedMessageId);
        if (!existingMessage || existingMessage.isDeleted) {
            throw new Error("Message not found");
        }
        if (existingMessage.conversationId !== normalizedConversationId) {
            throw new Error("Message does not belong to this conversation");
        }
        if (existingMessage.senderId !== normalizedUserId) {
            throw new Error("Forbidden: only message owner can delete this message");
        }

        return this.chatRepository.deleteMessage(normalizedMessageId);
    }
    // async displayMessages(conversationId: string) {
    //     const normalizedConversationId = conversationId.trim();
    //     if (!normalizedConversationId) {
    //         throw new Error("Conversation ID is required");
    //     }
    //     return this.chatRepository.displayMessages(normalizedConversationId);
    // }
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

    private async ensureRequesterIsGroupAdmin(conversationId: string, requesterUserId: string): Promise<void> {
        const normalizedRequesterUserId = requesterUserId.trim();
        if (!normalizedRequesterUserId) {
            throw new Error("Requester user ID is required");
        }

        const conversationWithUsers = await this.chatRepository.findConversationWithUsers(conversationId);
        if (!conversationWithUsers.conversation.isGroup) {
            throw new Error("Only group conversations support this action");
        }

        const requesterMembership = conversationWithUsers.users.find(
            (conversationUser) => conversationUser.userId === normalizedRequesterUserId,
        );
        if (!requesterMembership) {
            throw new Error("Forbidden: requester is not a member of this conversation");
        }
        if (!requesterMembership.admin) {
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