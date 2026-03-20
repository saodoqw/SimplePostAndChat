import bcrypt from 'bcryptjs';
import crypto from "crypto";

const DEFAULT_SALT_ROUNDS = 10;

export interface CryptionService {
    hashPassword(plainPassword: string): Promise<string>;
    verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean>;
    createRegistrationToken(): string;
    verifyRegistrationToken(token: string, expectedToken: string): boolean;
}

 class BcryptCryptionService implements CryptionService {
    constructor(private readonly saltRounds: number = DEFAULT_SALT_ROUNDS) {}

    async hashPassword(plainPassword: string): Promise<string> {
        return bcrypt.hash(plainPassword, this.saltRounds);
    }

    async verifyPassword(
        plainPassword: string,
        passwordHash: string
    ): Promise<boolean> {
        return bcrypt.compare(plainPassword, passwordHash);
    }

    createRegistrationToken(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    verifyRegistrationToken(token: string, expectedToken: string): boolean {
        return token === expectedToken;
    }
}

function getSaltRoundsFromEnv(): number {
    const rawValue = process.env.PASSWORD_SALT_ROUNDS;
    if (!rawValue) {
        return DEFAULT_SALT_ROUNDS;
    }

    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsed) || parsed < 8 || parsed > 15) {
        return DEFAULT_SALT_ROUNDS;
    }

    return parsed;
}

//when the application starts, it will read the salt rounds from the environment variable
//and create a single instance of BcryptCryptionService 
// that can be used throughout the application for hashing and verifying passwords.
export const cryptionService: CryptionService = new BcryptCryptionService(
    getSaltRoundsFromEnv()
);
