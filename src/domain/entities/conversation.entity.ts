const CONVERSATION_NAME_MAX_LENGTH = 100;

export class ConversationEntityValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ConversationEntityValidationError";
    }
}

interface ConversationEntityProps {
    id: string;
    name: string;
    isGroup: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export class ConversationEntity {
    readonly id: string;
    readonly name: string;
    readonly isGroup: boolean;
    readonly createdAt: Date;
    readonly updatedAt: Date;

    constructor(props: ConversationEntityProps) {
        ConversationEntity.validateForCreation(props.name);

        this.id = props.id;
        this.name = props.name.trim();
        this.isGroup = props.isGroup;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }

    static validateForCreation(name: string): void {
        const normalizedName = name.trim();

        if (!normalizedName) {
            throw new ConversationEntityValidationError("name is required");
        }

        if (normalizedName.length > CONVERSATION_NAME_MAX_LENGTH) {
            throw new ConversationEntityValidationError(
                `name must be at most ${CONVERSATION_NAME_MAX_LENGTH} characters`
            );
        }
    }
}
