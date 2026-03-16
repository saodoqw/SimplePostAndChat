import {
    UserEntity,
    UserEntityValidationError,
} from '../../domain/entities/user.entity.js';
import { type UserRepository } from '../../domain/repositories/user.repository.js';
import { type RedisService } from '../../infrastructure/redisService/redis.service.js';
import { type CloudinaryService } from '../../infrastructure/imageStorage/cloudinary/cloudinary.service.js';
import { type SendGridService } from '../../infrastructure/EmailSender/sendGrid.service.js';
const USER_CACHE_TTL_SECONDS = 15 * 60;

export interface CreateUserUseCaseInput {
    username: string;
    email: string;
    passwordHash: string;
}

export type CreateUserUseCaseOutput = UserEntity;

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
        private userRepository: UserRepository,
        private redisService: RedisService,
        private cloudinaryService: CloudinaryService,
        private sendGridService: SendGridService
    ) { }

    async createUser(
        input: CreateUserUseCaseInput
    ): Promise<CreateUserUseCaseOutput> {
        const username = input.username.trim();
        const email = input.email.trim().toLowerCase();
        const passwordHash = input.passwordHash;

        try {
            UserEntity.validateForCreation(username, email, passwordHash);
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

        const createdUser = await this.userRepository.create({
            username,
            email,
            passwordHash,
        });



        return createdUser;
    }
}