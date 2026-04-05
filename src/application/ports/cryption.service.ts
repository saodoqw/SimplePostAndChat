export interface CryptionService {
    hashPassword(plainPassword: string): Promise<string>;
    verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean>;
    createToken(): string;
    verifyToken(token: string, expectedToken: string): boolean;
}
