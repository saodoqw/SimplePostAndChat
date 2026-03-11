const USER_USERNAME_MAX_LENGTH = 50;
const USER_BIO_MAX_LENGTH = 300;

export class UserEntityValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "UserEntityValidationError";
    }
}

interface UserEntityProps {
    id: string;
    username: string;
    email: string;
    passwordHash: string;
    publicId: string;
    avatarUrl?: string | null;
    bio?: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export class UserEntity {
    readonly id: string;
    readonly username: string;
    readonly email: string;
    readonly passwordHash: string;
    readonly publicId: string;
    readonly avatarUrl: string | null;
    readonly bio: string | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;

    constructor(props: UserEntityProps) {
        UserEntity.validateForCreation(props.username, props.email, props.passwordHash, props.publicId);

        this.id = props.id;
        this.username = props.username.trim();
        this.email = props.email.trim().toLowerCase();
        this.passwordHash = props.passwordHash;
        this.publicId = props.publicId.trim();
        this.avatarUrl = props.avatarUrl ?? null;
        this.bio = props.bio ? props.bio.trim() : null;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }

    static validateForCreation(username: string, email: string, passwordHash: string, publicId: string): void {
        const normalizedUsername = username.trim();
        const normalizedEmail = email.trim();
        const normalizedPublicId = publicId.trim();

        if (!normalizedUsername) {
            throw new UserEntityValidationError("username is required");
        }

        if (normalizedUsername.length > USER_USERNAME_MAX_LENGTH) {
            throw new UserEntityValidationError(
                `username must be at most ${USER_USERNAME_MAX_LENGTH} characters`
            );
        }

        if (!normalizedEmail) {
            throw new UserEntityValidationError("email is required");
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            throw new UserEntityValidationError("email is invalid");
        }

        if (!passwordHash) {
            throw new UserEntityValidationError("passwordHash is required");
        }

        if (!normalizedPublicId) {
            throw new UserEntityValidationError("publicId is required");
        }
    }
}
