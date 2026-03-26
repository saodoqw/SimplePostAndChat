import { Router } from "express";
import { PrismaUserRepository } from "../../infrastructure/database/prisma/repositories/prisma-user.repository.js";
import { sendGridService } from "../../infrastructure/EmailSender/sendGrid.service.js";
import { cryptionService } from "../../infrastructure/encryption/cryption.service.js";
import { tokenService } from "../../infrastructure/encryption/jwt.service.js";
import { cloudinaryService } from "../../infrastructure/imageStorage/cloudinary/cloudinary.service.js";
import { redisService } from "../../infrastructure/redisService/redis.service.js";
import { AuthUseCase } from "../../usecases/auth/auth.usecase.js";
import { UserUseCase } from "../../usecases/users/users.usecases.js";
import { AuthController } from "../controllers/auth.controller.js";

const authRoutes = Router();

const userRepository = new PrismaUserRepository();
const userUseCase = new UserUseCase(
    userRepository,
    cryptionService,
    redisService,
    sendGridService,
    cloudinaryService,
);
const authUseCase = new AuthUseCase(userRepository, cryptionService, tokenService);
const authController = new AuthController(userUseCase, authUseCase);
// username, email, password in body
authRoutes.post("/register", authController.register);
// email, password in body
authRoutes.post("/login", authController.login);
//need email in query
authRoutes.get("/verify-email/:token", authController.verifyRegistrationToken);
authRoutes.post("/request-password-reset", authController.requestRefreshPassword);
// token in params, new password in body
authRoutes.post("/reset-password/:token", authController.verifyPasswordResetToken);
//
export default authRoutes;