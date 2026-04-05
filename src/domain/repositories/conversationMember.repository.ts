

export interface ConversationMemberRepository {
    addMemberToConversation(conversationId: string, userId: string, admin?: boolean): Promise<void>;
    removeMemberFromConversation(conversationId: string, userId: string): Promise<void>;
    isUserInConversation(conversationId: string, userId: string): Promise<boolean>;
    leaveConversation(conversationId: string, userId: string): Promise<void>;
    isAdmin(conversationId: string, userId: string): Promise<boolean>;
    // grantAdmin(conversationId: string, userId: string): Promise<void>;
    // revokeAdmin(conversationId: string, userId: string): Promise<void>;
    transferAdmin(conversationId: string, fromUserId: string, toUserId: string): Promise<void>;
}