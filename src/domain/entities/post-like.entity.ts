export class PostLikeEntityValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PostLikeEntityValidationError";
    }
}

interface PostLikeEntityProps {
    id: string;
    postId: string;
    userId: string;
    createdAt: Date;
}

export class PostLikeEntity {
    readonly id: string;
    readonly postId: string;
    readonly userId: string;
    readonly createdAt: Date;

    constructor(props: PostLikeEntityProps) {
        PostLikeEntity.validateForCreation(props.postId, props.userId);

        this.id = props.id;
        this.postId = props.postId.trim();
        this.userId = props.userId.trim();
        this.createdAt = props.createdAt;
    }

    static validateForCreation(postId: string, userId: string): void {
        if (!postId.trim()) {
            throw new PostLikeEntityValidationError("postId is required");
        }

        if (!userId.trim()) {
            throw new PostLikeEntityValidationError("userId is required");
        }
    }
}
