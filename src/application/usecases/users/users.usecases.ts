import {
    UserEntity,
    UserEntityValidationError,
} from '../../../domain/entities/user.entity.js';
import { type UserRepository } from '../../../domain/repositories/user.repository.js';
import { type EmailService } from '../../ports/email.service.js';
import { type CryptionService } from '../../ports/cryption.service.js';
import { type RedisService } from '../../../infrastructure/redisService/redis.service.js';
import { type ImageStorageService } from '../../ports/image-storage.service.js';
import { UserProfileDto, UserQueryService } from '../../queries/user.query.js';


export interface CreateUserUseCaseInput {
    username: string;
    email: string;
    password: string;
}

export interface UserCreateEntity {
    readonly username: string,
    readonly email: string;
    readonly passwordHash: string;
    readonly registrationToken: string;
    readonly isVerified: boolean;
}
export interface UserUpdateEntity {
    username?: string;
    passwordHash?: string;
    email?: string;
    publicId?: string;
    avatarUrl?: string | null;
    bio?: string | null;
}

export interface AvatarUploadInput {
    buffer: Buffer;
}

export class CreateUserValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CreateUserValidationError';
    }
}

export class CreateUserConflictError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CreateUserConflictError';
    }
}
export interface PublicUser {
    id: string;
    username: string;
    email: string;
    avatarUrl: string | null;
    bio: string | null;
}
export class UserUseCase {


    constructor(
        private readonly userRepository: UserRepository,
        private readonly userQueryService: UserQueryService,
        private readonly cryptionService: CryptionService,
        private readonly redisService: RedisService,
        private readonly sendGridService: EmailService,
        private readonly cloudinaryService: ImageStorageService,
    ) { }

    async searchUsers(query: string, searchingUserId: string) {
        // Application layer only coordinates the search rule.
        // The actual data access stays inside the repository.
        const trimmedQuery = this.normalizeRequiredString(query, "query");
        if (!trimmedQuery) {
            return [];
        }
        const users = await this.userRepository.searchUsersByUsernameOrEmail(trimmedQuery, searchingUserId);
        return users;
    }

    // This use case keeps registration state in Redis until email verification completes.
    // Reusing the existing token avoids invalidating a link when the user retries registration.
    async createTemporaryUser(
        input: CreateUserUseCaseInput
    ): Promise<void> {
        const username = this.normalizeRequiredString(input.username, "username");
        const email = this.normalizeRequiredString(input.email, "email").toLowerCase();
        const password = this.normalizeRequiredString(input.password, "password");

        try {
            UserEntity.validateForCreation(username, email, password);
        } catch (error) {
            if (error instanceof UserEntityValidationError) {
                throw new CreateUserValidationError(error.message);
            }

            throw error;
        }

        const existingUserByEmail = await this.userRepository.findByEmail(email);
        if (existingUserByEmail) {
            throw new CreateUserConflictError('email already exists');
        }

        const existingUserByUsername = await this.userRepository.findByUsername(username);
        if (existingUserByUsername) {
            throw new CreateUserConflictError('username already exists');
        }

        // Redis is used as a short-lived staging area before the user is persisted.
        const existingTempUser = await this.redisService.get<UserCreateEntity>(`tempUser:${email}`);

        const passwordHash = await this.cryptionService.hashPassword(password);

        // Reuse the previous token so the latest verification link stays valid.
        const registrationToken = existingTempUser?.registrationToken || this.cryptionService.createToken();

        const tempUser: UserCreateEntity = {
            username,
            email,
            passwordHash,
            registrationToken,
            isVerified: false,
        };

        await this.redisService.set(`tempUser:${email}`, tempUser, 60 * 30); // 30 minutes expiration

        // Only send a verification email on the first registration attempt.
        if (!existingTempUser) {
            await this.sendGridService.sendVerificationEmailWithTemplate(email, registrationToken);
        }
    }
    // Verify the token first, then persist the user, and finally clear the staging record.
    async verifyEmail(email: string, token: string): Promise<void> {
        const normalizedEmail = this.normalizeRequiredString(email, "email");
        const normalizedToken = this.normalizeRequiredString(token, "token");
        const tempUser = await this.redisService.get<UserCreateEntity>(`tempUser:${normalizedEmail}`);
        if (!tempUser) {
            throw new CreateUserValidationError('Invalid or expired registration token');
        }
        if (!this.cryptionService.verifyToken(normalizedToken, tempUser.registrationToken)) {
            throw new CreateUserValidationError('Invalid registration token');
        }
        await this.userRepository.create({
            username: tempUser.username,
            email: tempUser.email,
            passwordHash: tempUser.passwordHash,
        });
        await this.redisService.del(`tempUser:${normalizedEmail}`);
    }

    async getUserByEmail(email: string): Promise<UserEntity | null> {
        return this.userRepository.findByEmail(email);
    }
    async getUserProfile(userEmail: string, authUserId?: string): Promise<UserProfileDto | null> {
        if (!userEmail) {
            throw new Error("userEmail is required");
        }
        return this.userQueryService.getUserProfile(userEmail, authUserId);
    }

    async deleteUser(id: string): Promise<void> {
        // Remove DB state first, then clean up external media assets.
        // This keeps the database as the source of truth even if Cloudinary cleanup partially fails.
        const existingUser = await this.userRepository.findById(id);
        if (!existingUser) {
            throw new Error("User not found");
        }
        const mediaAssets = await this.userRepository.deleteAndGetMediaAssets(id);
        if (!mediaAssets.length) {
            return;
        }
        const assetMap = new Map();
        // Deduplicate asset deletions so repeated references do not trigger repeated Cloudinary calls.
        for (const asset of mediaAssets) {
            const key = `${asset.mediaType}:${asset.publicId}`;
            if (!assetMap.has(key)) {
                assetMap.set(key, asset);
            }
        }
        // Cloudinary cleanup runs in parallel and failures are tolerated after the DB delete succeeds.
        const uniqueAssets = Array.from(assetMap.values());

        const deleteResults = await Promise.allSettled(
            uniqueAssets.map((asset) =>
                asset.mediaType === "video"
                    ? this.cloudinaryService.deleteVideo(asset.publicId)
                    : this.cloudinaryService.deleteImage(asset.publicId)
            )
        );

        const failedDeletes = deleteResults
            .map((result, index) => ({ result, asset: uniqueAssets[index] }))
            .filter((entry) => entry.result.status === "rejected");

        if (failedDeletes.length) {
            console.error("Failed to delete some cloud assets after user deletion", {
                userId: id,
                failedAssets: failedDeletes.map((entry) => entry.asset.publicId),
            });
        }
    }
    async updateUser(
        id: string,
        updateData: UserUpdateEntity,
        avatarFile?: AvatarUploadInput
    ): Promise<UserEntity | null> {
        const existingUser = await this.userRepository.findById(id);

        if (!existingUser) {
            return null;
        }

        // Normalize request data here so controllers stay thin and transport-agnostic.
        const normalizedUpdateData: UserUpdateEntity = {
            ...updateData,
            username: updateData.username?.trim(),
            email: updateData.email?.trim().toLowerCase(),
            bio: updateData.bio === undefined ? undefined : updateData.bio?.trim() ?? null,
        };

        // If there is no new avatar, only the scalar fields need to be updated.
        if (!avatarFile) {
            return this.userRepository.update(id, normalizedUpdateData);
        }

        // Upload first so we only write the new publicId/url once the file is safely stored.
        const uploadedAvatar = await this.cloudinaryService.uploadAvatar(avatarFile.buffer, id);

        try {
            const updatedUser = await this.userRepository.update(id, {
                ...normalizedUpdateData,
                publicId: uploadedAvatar.publicId,
                avatarUrl: uploadedAvatar.url,
            });

            if (
                existingUser.publicId &&
                existingUser.publicId !== uploadedAvatar.publicId
            ) {
                await this.cloudinaryService.deleteImage(existingUser.publicId);
            }

            return updatedUser;
        } catch (error) {
            await this.cloudinaryService.deleteImage(uploadedAvatar.publicId).catch(() => undefined);
            throw error;
        }
    }
        // Password reset is also staged in Redis so the token expires automatically.
    async requestPasswordReset(email: string): Promise<void> {
        const normalizedEmail = this.normalizeRequiredString(email, "email");
        const user = await this.userRepository.findByEmail(normalizedEmail);
        if (!user) {
            throw new Error("User not found");
        }
        const existingToken = await this.redisService.get<string>(`passwordReset:${normalizedEmail}`);
        if (existingToken) {
            // Keep the existing token alive instead of spamming multiple reset emails.
            return;
        }
        const resetToken = this.cryptionService.createToken();
        await this.redisService.set(`passwordReset:${normalizedEmail}`, resetToken, 60 * 15); // 15 minutes expiration
        await this.sendGridService.sendPasswordResetEmailWithTemplate(normalizedEmail, resetToken);
    }

    async resetPassword(email: string, token: string, newPassword: string): Promise<void> {
        const normalizedEmail = this.normalizeRequiredString(email, "email");
        const normalizedToken = this.normalizeRequiredString(token, "token");
        const normalizedNewPassword = this.normalizeRequiredString(newPassword, "newPassword");
        const storedToken = await this.redisService.get<string>(`passwordReset:${normalizedEmail}`);

        if (!storedToken || !this.cryptionService.verifyToken(normalizedToken, storedToken)) {
            throw new Error("Invalid or expired password reset token");
        }
        // Only after the token is valid do we update the password hash in the repository.
        const user = await this.userRepository.findByEmail(normalizedEmail);
        if (!user) {
            throw new Error("User not found");
            return;
        }
        const newPasswordHash = await this.cryptionService.hashPassword(normalizedNewPassword);
        await this.userRepository.update(user.id, { passwordHash: newPasswordHash });
        await this.redisService.del(`passwordReset:${normalizedEmail}`);
    }
    // Follow/unfollow users
    async followUser(followerId: string, followingId: string): Promise<void> {
        if (followerId === followingId) {
            throw new Error("Users cannot follow themselves");
        }
        await this.userRepository.followUser(followerId, followingId);
    }
    async unfollowUser(followerId: string, followingId: string): Promise<void> {
        if (followerId === followingId) {
            throw new Error("Users cannot unfollow themselves");
        }
        await this.userRepository.unfollowUser(followerId, followingId);
    }
    async isFollowing(followerId: string, followingId: string): Promise<boolean> {
        return this.userRepository.isFollowing(followerId, followingId);
    }
    async isbothFollowing(userId1: string, userId2: string): Promise<boolean> {
        return this.userRepository.isbothFollowing(userId1, userId2);
    }
    async getFollowersCount(userId: string): Promise<number> {
        if (!userId) {
            throw new Error("userId is required");
        }
        const existingUser = await this.userRepository.findById(userId);
        if (!existingUser) {
            throw new Error("User not found");
        }
        const followers = await this.userRepository.getFollowers(userId);
        return followers.length;
    }
    async getFollowingCount(userId: string): Promise<number> {
        if (!userId) {
            throw new Error("userId is required");
        }
        const existingUser = await this.userRepository.findById(userId);
        if (!existingUser) {
            throw new Error("User not found");
        }
        // Same count logic as followers, but for outbound relationships.
        const following = await this.userRepository.getFollowing(userId);
        return following.length;
    }
    async getFollowers(userId: string): Promise<PublicUser[]> {
        if (!userId) {
            throw new Error("userId is required");
        }
        const existingUser = await this.userRepository.findById(userId);
        if (!existingUser) {
            throw new Error("User not found");
        }
        // Return only public fields so the UI never sees private data accidentally.
        const followers = await this.userRepository.getFollowers(userId);
        return followers.map((user) => ({
            id: user.id,
            username: user.username,
            email: user.email,
            avatarUrl: user.avatarUrl,
            bio: user.bio,
        }));

    }
    async getFollowing(userId: string): Promise<PublicUser[]> {
        if (!userId) {
            throw new Error("userId is required");
        }
        const existingUser = await this.userRepository.findById(userId);
        if (!existingUser) {
            throw new Error("User not found");
        }
        const following = await this.userRepository.getFollowing(userId);
        return following.map((user) => ({
            id: user.id,
            username: user.username,
            email: user.email,
            avatarUrl: user.avatarUrl,
            bio: user.bio,
        }));
    }

    private normalizeRequiredString(value: string, fieldName: string): string {
        if (typeof value !== "string") {
            throw new CreateUserValidationError(`${fieldName} is required`);
        }

        // Shared input guard so every public method gets the same validation behavior.
        const normalizedValue = value.trim();
        if (!normalizedValue) {
            throw new CreateUserValidationError(`${fieldName} is required`);
        }

        return normalizedValue;
    }
}