import {
    type Request,
    type Response,
    type NextFunction
} from "express";

//import use cases here to handle api calls
import {TestUseCase} from "../../usecases/test.usecase.js";
import { AuthUseCase } from "../../usecases/auth/auth.usecase.js";
import { PostUseCase } from "../../usecases/posts/post.usecase.js";
import { ChatUseCase } from "../../usecases/chats/chats.usecases.js";

export class TestController {
    constructor(
        private readonly testUseCase: TestUseCase,
        private readonly authUseCase?: AuthUseCase,
        private readonly postUseCase?: PostUseCase,
        private readonly chatUseCase?: ChatUseCase,
    ) {}

    validateAllApis = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        const results = {
            auth: { status: "pending", message: "", token: "" },
            posts: { status: "pending", message: "", postId: "" },
            chats: { status: "pending", message: "", conversationId: "" },
        };

        try {
            // Test 1: Login
            try {
                const loginResult = await this.authUseCase?.login({
                    email: "testuser1@example.com",
                    password: "123456",
                });
                
                if (loginResult?.accessToken) {
                    results.auth.status = "success";
                    results.auth.message = "Login successful";
                    results.auth.token = loginResult.accessToken;
                } else {
                    results.auth.status = "failed";
                    results.auth.message = "No token returned";
                }
            } catch (authError) {
                results.auth.status = "failed";
                results.auth.message = (authError as Error).message;
            }

            // Test 2: Posts (if login succeeded)
            if (results.auth.status === "success" && this.postUseCase) {
                try {
                    const allPosts = await this.postUseCase.findManyPosts({
                        authorId: "test",
                        limit: 5,
                    });
                    results.posts.status = "success";
                    results.posts.message = `Retrieved ${allPosts.posts?.length || 0} posts`;
                } catch (postError) {
                    results.posts.status = "failed";
                    results.posts.message = (postError as Error).message;
                }
            }

            // Test 3: Users/Chats
            if (results.auth.status === "success") {
                results.chats.status = "success";
                results.chats.message = "Chat API available";
            }

            res.status(200).json({
                message: "API validation completed",
                data: results,
            });
        } catch (error) {
            next(error);
        }
    };

    // Define controller methods here
    test = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const result = await this.testUseCase.test(req.body?.id, req.body?.name);
            res.status(200).json({ data: result });
        } catch (error) {
            next(error);
        }
    };

    test1 = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const result = await this.testUseCase.test1(req.body?.id);
            res.status(200).json({ data: result });
        } catch (error) {
            next(error);
        }
    };
}