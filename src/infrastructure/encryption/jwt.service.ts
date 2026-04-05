import jwt from "jsonwebtoken";
import {
    type AccessTokenPayload,
    type JwtService,
} from "../../application/ports/jwt.service.js";

const DEFAULT_ACCESS_TOKEN_EXPIRES_IN = "15m";
const DEFAULT_REFRESH_TOKEN_EXPIRES_IN = "7d";

function normalizeExpiresIn(
    value: jwt.SignOptions["expiresIn"] | undefined,
): jwt.SignOptions["expiresIn"] | undefined {
    if (value === undefined) {
        return undefined;
    }

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "none" || normalized === "off" || normalized === "false") {
            return undefined;
        }
    }

    return value;
}

type TokenType = "access" | "refresh";

interface SignedTokenPayload extends AccessTokenPayload {
    tokenType: TokenType;
}

 class TokenServiceIml implements JwtService {
     private readonly accessTokenExpiresIn?: jwt.SignOptions["expiresIn"];
     private readonly refreshTokenExpiresIn?: jwt.SignOptions["expiresIn"];

    constructor(
        private readonly jwtSecret: string,
        accessTokenExpiresIn: jwt.SignOptions["expiresIn"] | undefined =
            (process.env.JWT_ACCESS_TOKEN_EXPIRES_IN as jwt.SignOptions["expiresIn"] | undefined) ??
            DEFAULT_ACCESS_TOKEN_EXPIRES_IN,
        refreshTokenExpiresIn: jwt.SignOptions["expiresIn"] | undefined =
            (process.env.JWT_REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions["expiresIn"] | undefined) ??
            DEFAULT_REFRESH_TOKEN_EXPIRES_IN,
    ) {
        if (!jwtSecret) {
            throw new Error("JWT secret is not configured");
        }

        this.accessTokenExpiresIn = normalizeExpiresIn(accessTokenExpiresIn);
        this.refreshTokenExpiresIn = normalizeExpiresIn(refreshTokenExpiresIn);
    }

    generateAccessToken(payload: AccessTokenPayload): string {
        return this.signToken(payload, "access", this.accessTokenExpiresIn);
    }

    generateRefreshToken(payload: AccessTokenPayload): string {
        return this.signToken(payload, "refresh", this.refreshTokenExpiresIn);
    }

    verifyAccessToken(token: string): AccessTokenPayload {
        return this.verifyToken(token, "access");
    }

    verifyRefreshToken(token: string): AccessTokenPayload {
        return this.verifyToken(token, "refresh");
    }

    private signToken(
        payload: AccessTokenPayload,
        tokenType: TokenType,
        expiresIn?: jwt.SignOptions["expiresIn"],
    ): string {
        const signOptions: jwt.SignOptions = { algorithm: "HS256" };

        if (expiresIn !== undefined) {
            signOptions.expiresIn = expiresIn;
        }

        return jwt.sign({ ...payload, tokenType }, this.jwtSecret, signOptions);
    }

    private verifyToken(token: string, expectedType: TokenType): AccessTokenPayload {
        const decoded = jwt.verify(token, this.jwtSecret, { algorithms: ["HS256"] });

        if (typeof decoded === "string") {
            throw new Error("Invalid token payload");
        }

        const parsedPayload = this.parsePayload(decoded);

        if (parsedPayload.tokenType !== expectedType) {
            throw new Error("Invalid token type");
        }

        return {
            userId: parsedPayload.userId,
            username: parsedPayload.username,
            email: parsedPayload.email,
        };
    }

    private parsePayload(payload: jwt.JwtPayload): SignedTokenPayload {
        const { userId, username, email, tokenType } = payload;

        if (
            typeof userId !== "string" ||
            typeof username !== "string" ||
            typeof email !== "string" ||
            (tokenType !== "access" && tokenType !== "refresh")
        ) {
            throw new Error("Invalid token payload");
        }

        return {
            userId,
            username,
            email,
            tokenType,
        };
    }
}

export const tokenService: JwtService = new TokenServiceIml(process.env.JWT_SECRET as string);