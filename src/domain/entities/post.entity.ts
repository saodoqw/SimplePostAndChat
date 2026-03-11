const POST_CONTENT_MAX_LENGTH = 2000;

export class PostEntityValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PostEntityValidationError";
    }
}

interface PostEntityProps {
    id: string;
    authorId: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
}

export class PostEntity {
    readonly id: string;
    readonly authorId: string;
    readonly content: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;

    constructor(props: PostEntityProps) {
        PostEntity.validateForCreation(props.authorId, props.content);

        this.id = props.id;
        this.authorId = props.authorId.trim();
        this.content = props.content.trim();
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }

    static validateForCreation(authorId: string, content: string): void {
        const normalizedAuthorId = authorId.trim();
        const normalizedContent = content.trim();

        if (!normalizedAuthorId) {
            throw new PostEntityValidationError("authorId is required");
        }

        if (!normalizedContent) {
            throw new PostEntityValidationError("content is required");
        }

        if (normalizedContent.length > POST_CONTENT_MAX_LENGTH) {
            throw new PostEntityValidationError(
                `content must be at most ${POST_CONTENT_MAX_LENGTH} characters`
            );
        }
    }
}