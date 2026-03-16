import { Router } from "express";
//feature routes
import postRoutes from "./post.routes.js";
import testRoute from "./test.routes.js";
import userRoutes from "./users.routes.js";
// import chatRoutes from "./chats.routes.js";

const apiRoutes = Router();

//mount feature routes
apiRoutes.use("/posts", postRoutes);
apiRoutes.use("/tests", testRoute);
apiRoutes.use("/users", userRoutes);
// apiRoutes.use("/chats", chatRoutes);

export default apiRoutes;