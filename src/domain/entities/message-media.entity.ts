export class MessageMediaEntityValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MessageMediaEntityValidationError";
    }
}

interface MessageMediaEntityProps {
    id: string;
    messageId: string;
    mediaUrl: string;
    mediaType: string;
    publicId: string;
    createdAt: Date;
}

export class MessageMediaEntity {
    readonly id: string;
    readonly messageId: string;
    readonly mediaUrl: string;
    readonly mediaType: string;
    readonly publicId: string;
    readonly createdAt: Date;

    constructor(props: MessageMediaEntityProps) {
        MessageMediaEntity.validateForCreation(props.messageId, props.mediaUrl, props.mediaType, props.publicId);

        this.id = props.id;
        this.messageId = props.messageId.trim();
        this.mediaUrl = props.mediaUrl.trim();
        this.mediaType = props.mediaType.trim();
        this.publicId = props.publicId.trim();
        this.createdAt = props.createdAt;
    }

    static validateForCreation(messageId: string, mediaUrl: string, mediaType: string, publicId: string): void {
        if (!messageId.trim()) {
            throw new MessageMediaEntityValidationError("messageId is required");
        }

        if (!mediaUrl.trim()) {
            throw new MessageMediaEntityValidationError("mediaUrl is required");
        }

        if (!mediaType.trim()) {
            throw new MessageMediaEntityValidationError("mediaType is required");
        }

        if (!publicId.trim()) {
            throw new MessageMediaEntityValidationError("publicId is required");
        }
    }
}
