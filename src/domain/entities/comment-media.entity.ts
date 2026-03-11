export class CommentMediaEntityValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CommentMediaEntityValidationError";
    }
}

interface CommentMediaEntityProps {
    id: string;
    commentId: string;
    mediaUrl: string;
    mediaType: string;
    publicId: string;
    createdAt: Date;
}

export class CommentMediaEntity {
    readonly id: string;
    readonly commentId: string;
    readonly mediaUrl: string;
    readonly mediaType: string;
    readonly publicId: string;
    readonly createdAt: Date;

    constructor(props: CommentMediaEntityProps) {
        CommentMediaEntity.validateForCreation(props.commentId, props.mediaUrl, props.mediaType, props.publicId);

        this.id = props.id;
        this.commentId = props.commentId.trim();
        this.mediaUrl = props.mediaUrl.trim();
        this.mediaType = props.mediaType.trim();
        this.publicId = props.publicId.trim();
        this.createdAt = props.createdAt;
    }

    static validateForCreation(commentId: string, mediaUrl: string, mediaType: string, publicId: string): void {
        if (!commentId.trim()) {
            throw new CommentMediaEntityValidationError("commentId is required");
        }

        if (!mediaUrl.trim()) {
            throw new CommentMediaEntityValidationError("mediaUrl is required");
        }

        if (!mediaType.trim()) {
            throw new CommentMediaEntityValidationError("mediaType is required");
        }

        if (!publicId.trim()) {
            throw new CommentMediaEntityValidationError("publicId is required");
        }
    }
}
