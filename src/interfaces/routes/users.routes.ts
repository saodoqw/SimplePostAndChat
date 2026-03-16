import { Router } from "express";
import { PrismaUserRepository } from "../../infrastructure/database/prisma/repositories/prisma-user.repository.js";
import { UserUseCase } from "../../usecases/users/users.usecases.js";
import { UserController } from "../controllers/user.controller.js";
import { redisService } from "../../infrastructure/redisService/redis.service.js";

const userRoutes = Router();

// Repository where we interact with the database
const userRepository = new PrismaUserRepository();
// Use case where we implement the business logic
const userUseCase = new UserUseCase(userRepository, redisService);
// Controller where we handle the request and response
const userController = new UserController(userUseCase);

userRoutes.post("/", userController.create);
userRoutes.post("/register", userController.register);

export default userRoutes;