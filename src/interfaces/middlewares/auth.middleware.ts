import { type NextFunction, type Request, type Response } from "express";
import { type AccessTokenPayload, type JwtService } from "../../infrastructure/encryption/jwt.service.js";

export interface AuthenticatedRequest extends Request {
	authUser: AccessTokenPayload;
}

export function createAuthMiddleware(jwtService: JwtService) {
	return (
		req: Request,
		res: Response,
		next: NextFunction,
	): void => {
		const authorizationHeader = req.headers.authorization;

		if (!authorizationHeader) {
			res.status(401).json({ message: "Authorization header is required" });
			return;
		}

		const [scheme, token] = authorizationHeader.split(" ");

		if (scheme !== "Bearer" || !token) {
			res.status(401).json({ message: "Authorization must be in Bearer token format" });
			return;
		}

		try {
			// Verify the token and attach the user info to the request object
			const authUser = jwtService.verifyAccessToken(token);
			(req as AuthenticatedRequest).authUser = authUser;
			next();
		} catch {
			res.status(401).json({ message: "Invalid or expired access token" });
		}
	};
}

