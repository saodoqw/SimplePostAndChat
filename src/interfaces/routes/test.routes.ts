import { Router } from "express";
// import controllers to handle api calls and inject dependencies here
import { TestController } from "../controllers/test.controller.js";
import { TestUseCase } from "../../usecases/test.usecase.js";
import { TestRepository } from "../../infrastructure/testRepository.js";

// Import dependencies for API validation
import { AuthUseCase } from "../../usecases/auth/auth.usecase.js";
import { PostUseCase } from "../../usecases/posts/post.usecase.js";
import { ChatUseCase } from "../../usecases/chats/chats.usecases.js";

import { PrismaUserRepository } from "../../infrastructure/database/prisma/repositories/prisma-user.repository.js";
import { PrismaPostRepository } from "../../infrastructure/database/prisma/repositories/prisma-post.repository.js";
import { PrismaChatRepository } from "../../infrastructure/database/prisma/repositories/prisma-chat.repository.js";

import { cryptionService } from "../../infrastructure/encryption/cryption.service.js";
import { tokenService } from "../../infrastructure/encryption/jwt.service.js";
import { cloudinaryService } from "../../infrastructure/imageStorage/cloudinary/cloudinary.service.js";
import { redisService } from "../../infrastructure/redisService/redis.service.js";
import { sendGridService } from "../../infrastructure/EmailSender/sendGrid.service.js";

// Initialize repositories, use cases, and controllers here 
//can also be done in a separate file and imported here to keep things organized
const testRepository = new TestRepository();
const testUseCase = new TestUseCase(testRepository);

// Setup dependencies for validation
const userRepository = new PrismaUserRepository();
const postRepository = new PrismaPostRepository();
const chatRepository = new PrismaChatRepository();

const authUseCase = new AuthUseCase(userRepository, cryptionService, tokenService);
const postUseCase = new PostUseCase(postRepository, cloudinaryService);
const chatUseCase = new ChatUseCase(chatRepository, cloudinaryService, userRepository);

const testController = new TestController(testUseCase, authUseCase, postUseCase, chatUseCase);

const testRoute = Router();
// Define test routes here
testRoute.get("/validate-apis", testController.validateAllApis);
testRoute.get("/test", testController.test);
testRoute.post("/test1", testController.test1);

export default testRoute;