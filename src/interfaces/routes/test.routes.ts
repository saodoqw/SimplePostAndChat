import { Router } from "express";
// import controllers to handle api calls and inject dependencies here
import { TestController } from "../controllers/test.controller.js";
import { TestUseCase } from "../../usecases/test.usecase.js";
import { TestRepository } from "../../infrastructure/testRepository.js";

// Initialize repositories, use cases, and controllers here 
//can also be done in a separate file and imported here to keep things organized
const testRepository = new TestRepository();
const testUseCase = new TestUseCase(testRepository);
const testController = new TestController(testUseCase);

const testRoute = Router();
// Define test routes here 
testRoute.get("/test", testController.test);
testRoute.post("/test1", testController.test1);

export default testRoute;