import { Router } from "express";
//middlewares jwt 
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { tokenService } from "../../infrastructure/encryption/jwt.service.js";

//feature routes
import authRoutes from "./auth.routes.js";
import postRoutes from "./post.routes.js";
import userRoutes from "./users.routes.js";
import chatRoutes from "./chats.route.js";

const AuthMiddleware = authMiddleware(tokenService);

const apiRoutes = Router();

//mount feature routes
apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/posts", AuthMiddleware, postRoutes);
apiRoutes.use("/users", AuthMiddleware, userRoutes);
apiRoutes.use("/chats", AuthMiddleware, chatRoutes);

export default apiRoutes;