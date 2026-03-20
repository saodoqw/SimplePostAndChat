import {
    UserEntity,
    UserEntityValidationError,
} from '../../domain/entities/user.entity.js';
import { type UserRepository } from '../../domain/repositories/user.repository.js';
import {type SendGridService } from '../../infrastructure/EmailSender/sendGrid.service.js';
import { type CryptionService } from '../../infrastructure/encryption/cryption.service.js';
import { type RedisService } from '../../infrastructure/redisService/redis.service.js';
import {type CloudinaryService } from '../../infrastructure/imageStorage/cloudinary/cloudinary.service.js';


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

export class UserUseCase {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly cryptionService: CryptionService,
        private readonly redisService: RedisService,
        private readonly sendGridService: SendGridService,
        private readonly cloudinaryService: CloudinaryService,
    ) { }

    // This method creates a temporary user in Redis with a 15-minute expiration.
    //User needs to verify their email within 15 minutes,
    //otherwise they will need to start the registration process again.
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

        const passwordHash = await this.cryptionService.hashPassword(password);
        const registrationToken = this.cryptionService.createRegistrationToken();
        const tempUser: UserCreateEntity = {
            username,
            email,
            passwordHash,
            registrationToken,
            isVerified: false,
        };
        await this.redisService.set(`tempUser:${email}`, tempUser, 60 * 30); // 30 minutes expiration
        
        await this.sendGridService.sendVerificationEmailWithTemplate(email, registrationToken);
    }
    //Verify user and save to database, then delete the temporary user from Redis
    async verifyEmail(email: string, token: string): Promise<void> {
        const tempUser = await this.redisService.get<UserCreateEntity>(`tempUser:${email}`);
        if (!tempUser) {
            throw new CreateUserValidationError('Invalid or expired registration token');
        }
        if (!this.cryptionService.verifyRegistrationToken(token, tempUser.registrationToken)) {
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
        return this.userRepository.delete(id);
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

}