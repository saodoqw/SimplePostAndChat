
import { MessageEntity } from "../entities/message.entity.js";

export interface CreateMessageRepositoryInput {
    conversationId: string;
    senderId: string;
    content?: string | null;
}
export interface createMessageWithMediaRepositoryInput extends CreateMessageRepositoryInput {
    media: MediaInput[];
}
export interface MediaInput {
    mediaUrl: string;
    mediaType: string;
    publicId: string;
}

export interface MessageRepository {
    createMessage(input: CreateMessageRepositoryInput): Promise<MessageEntity>;
    createMessageWithMedia(input: createMessageWithMediaRepositoryInput): Promise<MessageEntity>;
    findMessageById(messageId: string): Promise<MessageEntity | null>;
    updateMessage(messageId: string, content: string): Promise<MessageEntity>;
    deleteMessage(messageId: string): Promise<void>;
}