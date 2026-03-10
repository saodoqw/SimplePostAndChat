import { Router } from "express";
import { PrismaPostRepository } from "../../infrastructure/database/prisma/repositories/prisma-post.repository.js";
import { CreatePostUseCase } from "../../usecases/posts/create-post.usecase.js";
import { PostController } from "../controllers/post.controller.js";

const postRoutes = Router();

const postRepository = new PrismaPostRepository();
const createPostUseCase = new CreatePostUseCase(postRepository);
const postController = new PostController(createPostUseCase);

postRoutes.post("/", postController.create);

export default postRoutes;