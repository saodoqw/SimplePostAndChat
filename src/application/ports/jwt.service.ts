export interface AccessTokenPayload {
    userId: string;
    username: string;
    email: string;
}

export interface JwtService {
    generateAccessToken(payload: AccessTokenPayload): string;
    generateRefreshToken(payload: AccessTokenPayload): string;

    verifyAccessToken(token: string): AccessTokenPayload;
    verifyRefreshToken(token: string): AccessTokenPayload;
}
