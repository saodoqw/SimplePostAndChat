import { type Request, type Response, type NextFunction } from "express";
import {
    CreateUserConflictError,
    CreateUserValidationError,
    UserUseCase,
} from "../../usecases/users/users.usecases.js";
import { type UserEntity } from "../../domain/entities/user.entity.js";
import { type AuthenticatedRequest } from "../middlewares/auth.middleware.js";

export class UserController {


    constructor(private readonly userUseCase: UserUseCase) { }



    findByEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const email = this.getBodyString(req.params?.email).trim();
            if (!email) {
                res.status(400).json({ message: "email is required" });
                return;
            }
            const user = await this.userUseCase.getUserByEmail(email);
            if (!user) {
                res.status(404).json({ message: "User not found" });
                return;
            }
            res.status(200).json({ data: this.toResponse(user) });
        }
        catch (error) {
            res.status(400).json({ message: (error as Error).message }); next(error);
        }
    };
    searchUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const query = this.getBodyString(req.params?.query).trim();
            const authUser = (req as AuthenticatedRequest).authUser;
            if (!query) {
                res.status(400).json({ message: "Search query is required" });
                return;
            }

            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }

            const users = await this.userUseCase.searchUsers(query, authUser.userId);
            res.status(200).json({ data: users.map(this.toResponse) });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };


    updateUser = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = this.getBodyString(req.params?.id).trim();
            const authUser = (req as AuthenticatedRequest).authUser;

            if (!id) {
                res.status(400).json({ message: "id is required" });
                return;
            }

            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }

            if (authUser.userId !== id) {
                res.status(403).json({ message: "Forbidden" });
                return;
            }

            const updatedUser = await this.userUseCase.updateUser(
                id,
                {
                    username: this.getOptionalBodyString(req.body?.username),
                    bio: this.getOptionalBodyString(req.body?.bio),
                }
            );

            if (!updatedUser) {
                res.status(404).json({ message: "User not found" });
                return;
            }

            res.status(200).json({ data: this.toResponse(updatedUser) });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };

    updateAvatar = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = this.getBodyString(req.params?.id).trim();
            const authUser = (req as AuthenticatedRequest).authUser;

            if (!id) {
                res.status(400).json({ message: "id is required" });
                return;
            }

            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }

            if (authUser.userId !== id) {
                res.status(403).json({ message: "Forbidden" });
                return;
            }

            const avatarInput = req.file?.buffer?.length
                ? { buffer: req.file.buffer }
                : undefined;

            if (!avatarInput) {
                res.status(400).json({ message: "avatar file is required" });
                return;
            }

            const updatedUser = await this.userUseCase.updateUser(
                id,
                {},
                avatarInput
            );


            if (!updatedUser) {
                res.status(404).json({ message: "User not found" });
                return;
            }

            res.status(200).json({ data: this.toResponse(updatedUser) });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };

    deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = this.getBodyString(req.params?.id).trim();
            const authUser = (req as AuthenticatedRequest).authUser;
            if (!id) {
                res.status(400).json({ message: "id is required" });
                return;
            }
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            if (authUser.userId !== id) {
                res.status(403).json({ message: "Forbidden: You can only delete your own account" });
                return;
            }
            await this.userUseCase.deleteUser(id);
            res.status(204).send("Delete success");
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };
    followUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = this.getBodyString(req.params?.id).trim();
            const authUser = (req as AuthenticatedRequest).authUser;
            if (!id) {
                res.status(400).json({ message: "id is required" });
                return;
            }
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            if (authUser.userId === id) {
                res.status(400).json({ message: "Cannot follow yourself" });
                return;
            }
            await this.userUseCase.followUser(authUser.userId, id);
            res.status(200).json({ message: "Followed user successfully" });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };

    unfollowUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = this.getBodyString(req.params?.id).trim();
            const authUser = (req as AuthenticatedRequest).authUser;
            if (!id) {
                res.status(400).json({ message: "id is required" });
                return;
            }
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            if (authUser.userId === id) {
                res.status(400).json({ message: "Cannot unfollow yourself" });
                return;
            }
            await this.userUseCase.unfollowUser(authUser.userId, id);
            res.status(200).json({ message: "Unfollowed user successfully" });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };
    isFollowing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = this.getBodyString(req.params?.id).trim();
            const authUser = (req as AuthenticatedRequest).authUser;
            if (!id) {
                res.status(400).json({ message: "id is required" });
                return;
            }
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            if (authUser.userId === id) {
                res.status(400).json({ message: "Cannot check following status for yourself" });
                return;
            }
            const isFollowing = await this.userUseCase.isFollowing(authUser.userId, id);
            res.status(200).json({ data: { isFollowing } });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };
    isBothFollowing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = this.getBodyString(req.params?.id).trim();
            const authUser = (req as AuthenticatedRequest).authUser;
            if (!id) {
                res.status(400).json({ message: "id is required" });
                return;
            }
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            if (authUser.userId === id) {
                res.status(400).json({ message: "Cannot check following status for yourself" });
                return;
            }
            const isBothFollow = await this.userUseCase.isbothFollowing(authUser.userId, id);
            res.status(200).json({ data: { isBothFollow } });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };
    getFollowingCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = this.getBodyString(req.params?.id).trim();
            const authUser = (req as AuthenticatedRequest).authUser;

            if (!id) {
                res.status(400).json({ message: "id is required" });
                return;
            }
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }

            const followingCount = await this.userUseCase.getFollowingCount(id);
            res.status(200).json({ data: { followingCount } });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };
    getFollowersCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = this.getBodyString(req.params?.id).trim();

            if (!id) {
                res.status(400).json({ message: "id is required" });
                return;
            }
            const followersCount = await this.userUseCase.getFollowersCount(id);
            res.status(200).json({ data: { followersCount } });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };
    getFollowersPublicList = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = this.getBodyString(req.params?.id).trim();
            if (!id) {
                res.status(400).json({ message: "id is required" });
                return;
            }

            const followersList = await this.userUseCase.getFollowers(id);
            res.status(200).json({ data: { followersList } });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };
    getFollowingPublicList = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id = this.getBodyString(req.params?.id).trim();
            if (!id) {
                res.status(400).json({ message: "id is required" });
                return;
            }
            const followingList = await this.userUseCase.getFollowing(id);
            res.status(200).json({ data: { followingList } });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };
    private getBodyString(value: unknown): string {
        return typeof value === "string" ? value : "";
    }

    private getOptionalBodyString(value: unknown): string | undefined {
        return typeof value === "string" ? value : undefined;
    }
    private toResponse(user: UserEntity): Omit<UserEntity, "passwordHash" | "publicId"> {
        return {
            id: user.id,
            username: user.username,
            email: user.email,
            avatarUrl: user.avatarUrl,
            bio: user.bio,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }
}