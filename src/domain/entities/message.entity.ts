const MESSAGE_CONTENT_MAX_LENGTH = 2000;

export class MessageEntityValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MessageEntityValidationError";
    }
}

interface MessageEntityProps {
    id: string;
    conversationId: string;
    senderId: string;
    content?: string | null;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export class MessageEntity {
    readonly id: string;
    readonly conversationId: string;
    readonly senderId: string;
    readonly content: string | null;
    readonly isDeleted: boolean;
    readonly createdAt: Date;
    readonly updatedAt: Date;

    constructor(props: MessageEntityProps) {
        MessageEntity.validateForCreation(props.conversationId, props.senderId, props.content);

        this.id = props.id;
        this.conversationId = props.conversationId.trim();
        this.senderId = props.senderId.trim();
        this.content = props.content ? props.content.trim() : null;
        this.isDeleted = props.isDeleted;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }

    static validateForCreation(conversationId: string, senderId: string, content?: string | null): void {
        if (!conversationId.trim()) {
            throw new MessageEntityValidationError("conversationId is required");
        }

        if (!senderId.trim()) {
            throw new MessageEntityValidationError("senderId is required");
        }

        if (content !== undefined && content !== null) {
            const normalizedContent = content.trim();
            if (normalizedContent.length > MESSAGE_CONTENT_MAX_LENGTH) {
                throw new MessageEntityValidationError(
                    `content must be at most ${MESSAGE_CONTENT_MAX_LENGTH} characters`
                );
            }
        }
    }
}
