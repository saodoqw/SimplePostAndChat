export class PostMediaEntityValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PostMediaEntityValidationError";
    }
}

interface PostMediaEntityProps {
    id: string;
    postId: string;
    mediaUrl: string;
    mediaType: string;
    publicId: string;
    createdAt: Date;
}

export class PostMediaEntity {
    readonly id: string;
    readonly postId: string;
    readonly mediaUrl: string;
    readonly mediaType: string;
    readonly publicId: string;
    readonly createdAt: Date;

    constructor(props: PostMediaEntityProps) {
        PostMediaEntity.validateForCreation(
            props.postId,
            props.mediaUrl,
            props.mediaType,
            props.publicId
        );

        this.id = props.id;
        this.postId = props.postId.trim();
        this.mediaUrl = props.mediaUrl.trim();
        this.mediaType = props.mediaType.trim();
        this.publicId = props.publicId.trim();
        this.createdAt = props.createdAt;
    }

    static validateForCreation(
        postId: string,
        mediaUrl: string,
        mediaType: string,
        publicId: string
    ): void {
        if (!postId.trim()) {
            throw new PostMediaEntityValidationError("postId is required");
        }

        if (!mediaUrl.trim()) {
            throw new PostMediaEntityValidationError("mediaUrl is required");
        }

        if (!mediaType.trim()) {
            throw new PostMediaEntityValidationError("mediaType is required");
        }

        if (!publicId.trim()) {
            throw new PostMediaEntityValidationError("publicId is required");
        }
    }
}
