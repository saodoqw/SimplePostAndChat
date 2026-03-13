import { type ConversationEntity } from "../entities/conversation.entity.js";
import { type ConversationUserEntity } from "../entities/conversation-user.entity.js";
import { type MessageEntity } from "../entities/message.entity.js";
import { type MessageMediaEntity } from "../entities/message-media.entity.js";

export interface CreateConversationRepositoryInput {
	name: string;
	isGroup?: boolean;
	userIds: string[];
}
export interface UpdateConversationRepositoryInput {
	name?: string;
}

export interface FindConversationsQuery {
	userId: string;
	cursor?: string;
	limit: number;
}

export interface FindConversationsResult {
	conversations: ConversationEntity[];
	nextCursor?: string;
}

export interface ConversationWithUsersRepositoryInput {
	conversationId: string;
}

export interface ConversationWithUsersRepositoryResult {
	conversation: ConversationEntity;
	users: ConversationUserEntity[];
}
export interface CreateMessageRepositoryInput {
	conversationId: string;
	senderId: string;
	content?: string | null;
}
export interface MessageMediaRepositoryInput {
	mediaUrl: string;
	mediaType: string;
	publicId: string;
}
export interface CreateMessageWithMediaRepositoryInput extends CreateMessageRepositoryInput {
	media: MessageMediaRepositoryInput[];
}

export interface MessageWithMediaRepositoryResult {
	message: MessageEntity;
	media: MessageMediaEntity[];
}

export interface UpdateMessageRepositoryInput {
	content?: string;
}

export interface FindMessagesQuery {
	conversationId: string;
	cursor?: string;
	limit: number;
}

export interface FindMessagesResult {
	messages: MessageWithMediaRepositoryResult[];
	nextCursor?: string;
}



export interface ChatRepository {
	createConversation(input: CreateConversationRepositoryInput): Promise<ConversationEntity>;
	updateConversation(conversationId: string,
		input: UpdateConversationRepositoryInput): Promise<ConversationEntity>;
	deleteConversation(conversationId: string): Promise<void>;

	// Find conversations for a user
	findConversations(query: FindConversationsQuery): Promise<FindConversationsResult>;
	findConversationByUsername(username: string): Promise<FindConversationsResult | null>;
	findConversationWithUsers(conversationId: string): Promise<ConversationWithUsersRepositoryResult>;

    // Sub-domain: ConversationUser
    addUsersToConversation(conversationId: string, userIds: string[]): Promise<void>;
	removeUsersFromConversation(conversationId: string, userIds: string[]): Promise<void>;
    isUserInConversation(conversationId: string, userId: string): Promise<boolean>;
    

    // Sub-domain: Message
    createMessage(input: CreateMessageRepositoryInput): Promise<MessageEntity>;
    createMessageWithMedia(input: CreateMessageWithMediaRepositoryInput): Promise<MessageWithMediaRepositoryResult>;
    updateMessage(messageId: string, input: UpdateMessageRepositoryInput): Promise<MessageEntity>;
	findMessages(query: FindMessagesQuery): Promise<FindMessagesResult>;
    deleteMessage(messageId: string): Promise<void>;


}