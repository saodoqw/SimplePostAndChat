// Contract for test persistence
import {TestEntity } from "../entities/test.entity.js";

interface testDTO {
    id: string;
    name: string;
}
export interface ITestRepository {
    test(test: testDTO): Promise<void>;
    test1(id: string): Promise<TestEntity | null>;
}