export type SortOrder = "asc" | "desc";
export type MessageSortBy = "created_at" | "updated_at";
export type MessagePaginationDirection = "up" | "down";

export interface UserDto {
    id: string;
    username: string;
    avatarUrl: string | null;
}

export interface MessageMediaDto {
    messageId: string;
    mediaUrl: string;
    mediaType: string;
}

export interface MessageDto {
    id: string;
    conversationId: string;
    senderId: string;
    content: string | null;
    createdAt: Date;
    updatedAt: Date;
    user: UserDto;
    media: MessageMediaDto[];
}

export interface FindMessagesQuery {
    conversationId: string;
    cursor?: string;
    limit: number;
    sortBy?: MessageSortBy;
    sortOrder?: SortOrder;
    search?: string;
    direction?: MessagePaginationDirection;
}

export interface FindMessagesResult {
    items: MessageDto[];
    nextCursor?: string;
    prevCursor?: string;
}

export interface MessageQueryService {
    //get 10 latest messages with media for a conversation, sorted by createdAt desc
    getAllMessagesWithMedia(conversationId: string): Promise<MessageDto[]>;
    findMessages(query: FindMessagesQuery): Promise<FindMessagesResult>;
}