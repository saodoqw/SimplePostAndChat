import { type UserRepository } from "../../../domain/repositories/user.repository.js";
import { type CryptionService } from '../../ports/cryption.service.js';
import { type JwtService } from "../../ports/jwt.service.js";

export interface LoginInput {
    email: string;
    password: string;
}

export interface AuthUserOutput {
    id: string;
    username: string;
    email: string;
    avatarUrl: string;
}

export interface LoginOutput {
    accessToken: string;
    refreshToken: string;
    user: AuthUserOutput;
}

export class AuthValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AuthValidationError";
    }
}

export class AuthInvalidCredentialsError extends Error {
    constructor() {
        super("Invalid email or password");
        this.name = "AuthInvalidCredentialsError";
    }
}

export class AuthUseCase {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly cryptionService: CryptionService,
        private readonly jwtService: JwtService,
    ) { }

    async login(input: LoginInput): Promise<LoginOutput> {
        const email = this.normalizeRequiredString(input.email, "email").toLowerCase();
        const password = this.normalizeRequiredString(input.password, "password");

        if (!email) {
            throw new AuthValidationError("email is required");
        }

        if (!password) {
            throw new AuthValidationError("password is required");
        }

        const existingUser = await this.userRepository.findByEmail(email);
        if (!existingUser) {
            throw new AuthInvalidCredentialsError();
        }

        const isValidPassword = await this.cryptionService.verifyPassword(
            password,
            existingUser.passwordHash,
        );

        if (!isValidPassword) {
            throw new AuthInvalidCredentialsError();
        }

        const payload = {
            userId: existingUser.id,
            username: existingUser.username,
            email: existingUser.email,
        };

        return {
            accessToken: this.jwtService.generateAccessToken(payload),
            refreshToken: this.jwtService.generateRefreshToken(payload),
            user: {
                id: existingUser.id,
                username: existingUser.username,
                email: existingUser.email,
                avatarUrl: existingUser.avatarUrl || "",
            },
        };
    }
    getAccessTokenFromRefreshToken(refreshToken: string): string {
        try {
            const payload = this.jwtService.verifyRefreshToken(refreshToken);
            return this.jwtService.generateAccessToken({
                userId: payload.userId,
                username: payload.username,
                email: payload.email,
            });
        } catch (error) {
            throw new AuthValidationError("Invalid or expired refresh token");
        }
    }

    private normalizeRequiredString(value: string, fieldName: string): string {
        if (typeof value !== "string") {
            throw new AuthValidationError(`${fieldName} is required`);
        }

        const normalizedValue = value.trim();
        if (!normalizedValue) {
            throw new AuthValidationError(`${fieldName} is required`);
        }

        return normalizedValue;
    }
}