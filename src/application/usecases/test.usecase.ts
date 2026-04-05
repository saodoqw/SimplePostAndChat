//import interfaces here if interaction with infrastructure
import { ITestRepository } from "../domain/repositories/test.repository.js";


export class TestUseCase {
// dependency injection of repository (only needed when use case needs data access)
    private testRepository: ITestRepository;
    constructor(testRepository: ITestRepository) {
        this.testRepository = testRepository;
    }

    test(id: string, name: string) {
        //handle the logic here

        return this.testRepository.test({ id, name });
    }
    test1(id: string) {
        //handle the logic here

        return this.testRepository.test1(id);
    }
}


