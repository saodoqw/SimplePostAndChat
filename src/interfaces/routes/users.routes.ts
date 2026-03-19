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

userRoutes.post("/", userController.create);
userRoutes.post("/register", userController.register);
// userRoutes.get("/:id", userController.verifyRegistrationToken);
// userRoutes.get("/:email", userController.getByEmail);
userRoutes.patch("/:id/avatar", uploadAvatarMiddleware, userController.updateAvatar);

export default userRoutes;