export class FollowEntityValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "FollowEntityValidationError";
    }
}

interface FollowEntityProps {
    id: string;
    followerId: string;
    followingId: string;
    createdAt: Date;
}

export class FollowEntity {
    readonly id: string;
    readonly followerId: string;
    readonly followingId: string;
    readonly createdAt: Date;

    constructor(props: FollowEntityProps) {
        FollowEntity.validateForCreation(props.followerId, props.followingId);

        this.id = props.id;
        this.followerId = props.followerId.trim();
        this.followingId = props.followingId.trim();
        this.createdAt = props.createdAt;
    }

    static validateForCreation(followerId: string, followingId: string): void {
        const normalizedFollowerId = followerId.trim();
        const normalizedFollowingId = followingId.trim();

        if (!normalizedFollowerId) {
            throw new FollowEntityValidationError("followerId is required");
        }

        if (!normalizedFollowingId) {
            throw new FollowEntityValidationError("followingId is required");
        }

        if (normalizedFollowerId === normalizedFollowingId) {
            throw new FollowEntityValidationError("user cannot follow themselves");
        }
    }
}
