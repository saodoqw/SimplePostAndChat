import { Router } from "express";
import { PrismaUserRepository } from "../../infrastructure/database/prisma/repositories/prisma-user.repository.js";
import { UserUseCase } from "../../usecases/users/users.usecases.js";
import { UserController } from "../controllers/user.controller.js";
import { cryptionService } from "../../infrastructure/encryption/cryption.service.js";
import { redisService } from "../../infrastructure/redisService/redis.service.js";
import { sendGridService } from "../../infrastructure/EmailSender/sendGrid.service.js";
import { cloudinaryService } from "../../infrastructure/imageStorage/cloudinary/cloudinary.service.js";
import { uploadAvatarMiddleware } from "../middlewares/upload.middleware.js";

const userRoutes = Router();

// Repository where we interact with the database
const userRepository = new PrismaUserRepository();
// Use case where we implement the business logic
const userUseCase = new UserUseCase(
	userRepository,
	cryptionService,
	redisService,
	sendGridService,
	cloudinaryService
);
// Controller where we handle the request and response
const userController = new UserController(userUseCase);



//get profile user info by email
userRoutes.get("/:email", userController.findByEmail);
userRoutes.get("/search/:query", userController.searchUsers);
//id here is the id of user logged in, not the id of the user to get info of
//change avatar
userRoutes.patch("/:id/avatar", uploadAvatarMiddleware, userController.updateAvatar);
//update profile (username, bio)
userRoutes.patch("/:id/update", userController.updateUser);
userRoutes.delete("/:id", userController.deleteUser);
//follow/unfollow users
userRoutes.post("/:id/follow", userController.followUser);
userRoutes.post("/:id/unfollow", userController.unfollowUser);
//id here is the id of the user to check if the auth user is following or not
userRoutes.get("/:id/following-status", userController.isFollowing);
// id here is the public id of the user to get info of
userRoutes.get("/:id/followersCount", userController.getFollowersCount);
userRoutes.get("/:id/followingCount", userController.getFollowingCount);
userRoutes.get("/:id/followers", userController.getFollowersPublicList);
userRoutes.get("/:id/following", userController.getFollowingPublicList);

export default userRoutes;