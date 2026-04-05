import { ConversationEntity } from "../entities/conversation.entity.js";

export interface CreateConversationRepositoryInput {
    name: string;
    isGroup?: boolean;
    creatorUserId?: string;
    userIds: string[];
}

export interface UpdateConversationRepositoryInput {
    name?: string;
}

export interface ConversationMemberRepositoryResult {
    id: string;
    userId: string;
    conversationId: string;
    admin: boolean;
    createdAt: Date;
}

export interface ConversationWithUsersRepositoryResult {
    conversation: ConversationEntity;
    users: ConversationMemberRepositoryResult[];
}

export interface ConservationRepository {
    createConversation(input: CreateConversationRepositoryInput): Promise<ConversationEntity>;
    updateConversation(
        conversationId: string,
        input: UpdateConversationRepositoryInput,
    ): Promise<ConversationEntity>;
    deleteConversation(conversationId: string): Promise<void>;
    findConversationById(conversationId: string): Promise<ConversationEntity | null>;
    findDirectConversation(
        userId1: string,
        userId2: string,
    ): Promise<ConversationWithUsersRepositoryResult | null>;
}