export class ConversationUserEntityValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ConversationUserEntityValidationError";
    }
}

interface ConversationUserEntityProps {
    id: string;
    conversationId: string;
    userId: string;
    createdAt: Date;
}

export class ConversationUserEntity {
    readonly id: string;
    readonly conversationId: string;
    readonly userId: string;
    readonly createdAt: Date;

    constructor(props: ConversationUserEntityProps) {
        ConversationUserEntity.validateForCreation(props.conversationId, props.userId);

        this.id = props.id;
        this.conversationId = props.conversationId.trim();
        this.userId = props.userId.trim();
        this.createdAt = props.createdAt;
    }

    static validateForCreation(conversationId: string, userId: string): void {
        if (!conversationId.trim()) {
            throw new ConversationUserEntityValidationError("conversationId is required");
        }

        if (!userId.trim()) {
            throw new ConversationUserEntityValidationError("userId is required");
        }
    }
}
