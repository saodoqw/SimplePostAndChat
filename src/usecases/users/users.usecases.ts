import {
    UserEntity,
    UserEntityValidationError,
} from '../../domain/entities/user.entity.js';
import { type UserRepository } from '../../domain/repositories/user.repository.js';
import { type SendGridService } from '../../infrastructure/EmailSender/sendGrid.service.js';
import { type CryptionService } from '../../infrastructure/encryption/cryption.service.js';
import { type RedisService } from '../../infrastructure/redisService/redis.service.js';
import { type CloudinaryService } from '../../infrastructure/imageStorage/cloudinary/cloudinary.service.js';


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
        private readonly cryptionService: CryptionService,
        private readonly redisService: RedisService,
        private readonly sendGridService: SendGridService,
        private readonly cloudinaryService: CloudinaryService,
    ) { }

    async searchUsers(query: string, searchingUserId: string) {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) {
            return [];
        }
        const users = await this.userRepository.searchUsersByUsernameOrEmail(trimmedQuery, searchingUserId);
        return users;
    }

    // This method creates a temporary user in Redis with a 30-minute expiration.
    // If the user already has a pending registration, reuse the existing token instead of generating a new one.
    // This prevents token mismatch when user clicks register multiple times.
    async createTemporaryUser(
        input: CreateUserUseCaseInput
    ): Promise<void> {
        const username = input.username.trim();
        const email = input.email.trim().toLowerCase();
        const password = input.password;

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

        // Check if temporary user already exists in Redis
        const existingTempUser = await this.redisService.get<UserCreateEntity>(`tempUser:${email}`);

        const passwordHash = await this.cryptionService.hashPassword(password);

        // Reuse existing token if temporary user exists to avoid token mismatch
        const registrationToken = existingTempUser?.registrationToken || this.cryptionService.createToken();

        const tempUser: UserCreateEntity = {
            username,
            email,
            passwordHash,
            registrationToken,
            isVerified: false,
        };

        await this.redisService.set(`tempUser:${email}`, tempUser, 60 * 30); // 30 minutes expiration

        // Only send email if it's a new registration (no existing temporary user)
        if (!existingTempUser) {
            await this.sendGridService.sendVerificationEmailWithTemplate(email, registrationToken);
        }
    }
    //Verify user and save to database, then delete the temporary user from Redis
    async verifyEmail(email: string, token: string): Promise<void> {
        const tempUser = await this.redisService.get<UserCreateEntity>(`tempUser:${email}`);
        if (!tempUser) {
            throw new CreateUserValidationError('Invalid or expired registration token');
        }
        if (!this.cryptionService.verifyToken(token, tempUser.registrationToken)) {
            throw new CreateUserValidationError('Invalid registration token');
        }
        await this.userRepository.create({
            username: tempUser.username,
            email: tempUser.email,
            passwordHash: tempUser.passwordHash,
        });
        await this.redisService.del(`tempUser:${email}`);
    }

    async getUserByEmail(email: string): Promise<UserEntity | null> {
        return this.userRepository.findByEmail(email);
    }

    async deleteUser(id: string): Promise<void> {
        //delete user and get list of media assets to delete from cloudinary,
        // then delete media assets from cloudinary, finally delete user from database
        const existingUser = await this.userRepository.findById(id);
        if (!existingUser) {
            throw new Error("User not found");
        }
        const mediaAssets = await this.userRepository.deleteAndGetMediaAssets(id);
        if (!mediaAssets.length) {
            return;
        }
        const assetMap = new Map();
        //Use map to ensure we only attempt to delete each unique media asset once, in case of duplicates in the list
        for (const asset of mediaAssets) {
            const key = `${asset.mediaType}:${asset.publicId}`;
            if (!assetMap.has(key)) {
                assetMap.set(key, asset);
            }
        }
        //delete media assets from cloudinary in parallel,
        //but don't fail the whole operation if some deletions fail just log the errors
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

        const normalizedUpdateData: UserUpdateEntity = {
            ...updateData,
            username: updateData.username?.trim(),
            email: updateData.email?.trim().toLowerCase(),
            bio: updateData.bio === undefined ? undefined : updateData.bio?.trim() ?? null,
        };

        if (!avatarFile) {
            return this.userRepository.update(id, normalizedUpdateData);
        }

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
    //create temp request for changing password, send email with token, verify token and change password
    async requestPasswordReset(email: string): Promise<void> {
        const user = await this.userRepository.findByEmail(email);
        if (!user) {
            throw new Error("User not found");
        }
        const resetToken = this.cryptionService.createToken();
        await this.redisService.set(`passwordReset:${email}`, resetToken, 60 * 15); // 15 minutes expiration
        await this.sendGridService.sendPasswordResetEmailWithTemplate(email, resetToken);
    }

    async resetPassword(email: string, token: string, newPassword: string): Promise<void> {
        const storedToken = await this.redisService.get<string>(`passwordReset:${email}`);

        if (!storedToken || !this.cryptionService.verifyToken(token, storedToken)) {
            throw new Error("Invalid or expired password reset token");
        }
        const user = await this.userRepository.findByEmail(email);
        if (!user) {
            throw new Error("User not found");
            return;
        }
        const newPasswordHash = await this.cryptionService.hashPassword(newPassword);
        await this.userRepository.update(user.id, { passwordHash: newPasswordHash });
        await this.redisService.del(`passwordReset:${email}`);
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
}