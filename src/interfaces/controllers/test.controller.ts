import {
    type Request,
    type Response,
    type NextFunction
} from "express";

//import use cases here to handle api calls
import {TestUseCase} from "../../usecases/test.usecase.js";

export class TestController {
    constructor(private readonly testUseCase: TestUseCase) {}

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