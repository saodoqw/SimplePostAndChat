import {
    type ChatRepository,
    type CreateConversationRepositoryInput,
} from "../../domain/repositories/chat.repository.js";
import { type UserRepository } from "../../domain/repositories/user.repository.js";
import { type CloudinaryService } from '../../infrastructure/imageStorage/cloudinary/cloudinary.service.js';

const DEFAULT_DIRECT_CHAT_NAME = "Direct Chat";
const DEFAULT_GROUP_CHAT_NAME = "New Group";


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