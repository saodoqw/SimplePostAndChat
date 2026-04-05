export type SortOrder = "asc" | "desc";
export type ConversationSortBy = "created_at" | "updated_at";

export interface FindConversationsQuery {
    userId: string;
    cursor?: string;
    limit: number;
    sortBy?: ConversationSortBy;
    sortOrder?: SortOrder;
}
export interface FindConversationsResult {
    conversations: ConversationDto[];
    nextCursor?: string;
}
export interface ConversationDto {
    id: string;
    name: string;
    isGroup: boolean;
    lastMessage?: {
        content: string;
        createdAt: Date;
    };
}
export interface ConversationWithUsersRepositoryResult {
    conversation: ConversationDto;
    users: {
        id: string;
        username: string;
        avatarUrl: string | null;
        isAdmin: boolean;
        joinedAt: Date;
    }[];
}
export interface ConversationQueryService {
    // Get paginated conversations for a user, sorted by last updated time by default
    findConversations(query: FindConversationsQuery): Promise<FindConversationsResult>;
    // Get conversation details along with its users by conversation id
    getConversationById(conversationId: string): Promise<ConversationWithUsersRepositoryResult | null>;
    // Get direct conversation between two users, return null if not exist
    getDirectConversation(userId1: string, userId2: string): Promise<ConversationWithUsersRepositoryResult | null>;
    // Get all conversations that a user belongs to, without pagination, sorted by last updated time
    getAllConversationsBelongToUser(userId: string): Promise<ConversationWithUsersRepositoryResult[]>;
}