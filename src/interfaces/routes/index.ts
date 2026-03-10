import { Router } from "express";
//feature routes
import postRoutes from "./post.routes.js";
import testRoute from "./test.routes.js";

const apiRoutes = Router();

//mount feature routes
apiRoutes.use("/posts", postRoutes);
apiRoutes.use("/tests", testRoute);


export default apiRoutes;