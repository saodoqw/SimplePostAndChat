import { Router } from "express";
import { PrismaPostRepository } from "../../infrastructure/database/prisma/repositories/prisma-post.repository.js";
import { prismaPostLikeRepository } from "../../infrastructure/database/prisma/repositories/prisma-postlike.repository.js";
import { prismaCommentRepository } from "../../infrastructure/database/prisma/repositories/prisma-comment.repository.js";
import { prismaPostQuery } from "../../infrastructure/database/prisma/queries/prisma-post.query.js";
import { PrismaCommentQuery } from "../../infrastructure/database/prisma/queries/prisma-comment.query.js";
import { cloudinaryService } from "../../infrastructure/imageStorage/cloudinary/cloudinary.service.js";
import { uploadImageMiddleware } from "../middlewares/upload.middleware.js";

import { PostUseCase } from "../../usecases/posts/post.usecase.js";
import { PostController } from "../controllers/post.controller.js";

const postRoutes = Router();

const postRepository = new PrismaPostRepository();
const postQueryService = new prismaPostQuery();
const postLikeRepository = new prismaPostLikeRepository();
const commentRepository = new prismaCommentRepository();
const commentQueryService = new PrismaCommentQuery();
const postUseCase = new PostUseCase(
    postRepository,
    postQueryService,
    postLikeRepository,
    commentRepository,
    commentQueryService,
    cloudinaryService,
);
const postController = new PostController(postUseCase);

postRoutes.post('/create', uploadImageMiddleware, postController.create);
//get all posts of a user by user id
//can paginate by query params page and limit,sort by query param sortBy (created_at or updated_at) and order (asc or desc)
postRoutes.get('/user/:userId', postController.displayUserPosts);
//get details of a post by post id, including content, image url, author id
postRoutes.get('/details/:postId', postController.getPostDetails);
//update post content not image
postRoutes.patch('/update/:postId', postController.update);
postRoutes.delete('/delete/:postId', postController.delete);
postRoutes.get('/likeCommentCount/:postId', postController.getLikesCommentCount);
postRoutes.post('/likeUnlike/:postId', postController.likeUnlikePost);
postRoutes.get('/isLiked/:postId', postController.isPostLikedByAuthUser);
postRoutes.post('/comment/:postId', uploadImageMiddleware, postController.commentOnPost);
postRoutes.get('/comments/:postId', postController.getCommentsForPost);
postRoutes.delete('/comment/:commentId', postController.deleteComment);

export default postRoutes;