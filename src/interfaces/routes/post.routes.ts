import { Router } from "express";
import { PrismaPostRepository } from "../../infrastructure/database/prisma/repositories/prisma-post.repository.js";
import { cloudinaryService } from "../../infrastructure/imageStorage/cloudinary/cloudinary.service.js";
import { uploadImageMiddleware } from "../middlewares/upload.middleware.js";

import { CreatePostUseCase } from "../../usecases/posts/post.usecase.js";
import { PostController } from "../controllers/post.controller.js";

const postRoutes = Router();

const postRepository = new PrismaPostRepository();
const createPostUseCase = new CreatePostUseCase(postRepository, cloudinaryService);
const postController = new PostController(createPostUseCase);

postRoutes.post("/", uploadImageMiddleware, postController.create);

export default postRoutes;