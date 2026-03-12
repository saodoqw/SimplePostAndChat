import { PostEntity } from "../../../../domain/entities/post.entity.js";
import {
    type CreatePostRepositoryInput,
    type PostRepository,
} from "../../../../domain/repositories/post.repository.js";
import { prisma } from "../prismaClient.js";
