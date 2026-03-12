const USER_USERNAME_MAX_LENGTH = 50;
const USER_BIO_MAX_LENGTH = 300;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
        UserEntity.validateForCreation(
            props.username,
            props.email,
            props.passwordHash,
            props.publicId,
            props.bio
        );
        this.id = props.id;
        this.username = props.username.trim();
        this.email = props.email.trim().toLowerCase();
        this.passwordHash = props.passwordHash;
        this.publicId = props.publicId.trim();
        this.avatarUrl = props.avatarUrl ?? null;
        this.bio = props.bio?.trim() ?? null;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }

    static validateForCreation(
        username: string,
        email: string,
        passwordHash: string,
        publicId: string,
        bio?: string | null): void {
        const normalizedUsername = username.trim();
        const normalizedEmail = email.trim();
        const normalizedPublicId = publicId.trim();
        const normalizedBio = bio?.trim();
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
        if (!EMAIL_REGEX.test(normalizedEmail)) {
            throw new UserEntityValidationError("email is invalid");
        }

        if (!normalizedPublicId) {
            throw new UserEntityValidationError("publicId is required");
        }
        if (!passwordHash) {
            throw new UserEntityValidationError("passwordHash is required");
        }
        if (normalizedBio && normalizedBio.length > USER_BIO_MAX_LENGTH) {
            throw new UserEntityValidationError(
                `bio must be at most ${USER_BIO_MAX_LENGTH} characters`
            );
        }
    }
}