const COMMENT_CONTENT_MAX_LENGTH = 1000;

export class CommentEntityValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CommentEntityValidationError";
    }
}

interface CommentEntityProps {
    id: string;
    postId: string;
    userId: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
}

export class CommentEntity {
    readonly id: string;
    readonly postId: string;
    readonly userId: string;
    readonly content: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;

    constructor(props: CommentEntityProps) {
        CommentEntity.validateForCreation(props.postId, props.userId, props.content);

        this.id = props.id;
        this.postId = props.postId.trim();
        this.userId = props.userId.trim();
        this.content = props.content.trim();
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }

    static validateForCreation(postId: string, userId: string, content: string): void {
        const normalizedPostId = postId.trim();
        const normalizedUserId = userId.trim();
        const normalizedContent = content.trim();

        if (!normalizedPostId) {
            throw new CommentEntityValidationError("postId is required");
        }

        if (!normalizedUserId) {
            throw new CommentEntityValidationError("userId is required");
        }

        if (!normalizedContent) {
            throw new CommentEntityValidationError("content is required");
        }

        if (normalizedContent.length > COMMENT_CONTENT_MAX_LENGTH) {
            throw new CommentEntityValidationError(
                `content must be at most ${COMMENT_CONTENT_MAX_LENGTH} characters`
            );
        }
    }
}
