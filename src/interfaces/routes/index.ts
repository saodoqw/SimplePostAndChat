import { Router } from "express";
//middlewares jwt 
import { createAuthMiddleware } from "../middlewares/auth.middleware.js";
import { tokenService } from "../../infrastructure/encryption/jwt.service.js";

//feature routes
import authRoutes from "./auth.routes.js";
import postRoutes from "./post.routes.js";
import testRoute from "./test.routes.js";
import userRoutes from "./users.routes.js";
// import chatRoutes from "./chats.routes.js";

const AuthMiddleware = createAuthMiddleware(tokenService);

const apiRoutes = Router();

//mount feature routes
apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/posts", AuthMiddleware, postRoutes);
apiRoutes.use("/tests", AuthMiddleware, testRoute);
apiRoutes.use("/users", AuthMiddleware, userRoutes);
// apiRoutes.use("/chats", AuthMiddleware, chatRoutes);

export default apiRoutes;