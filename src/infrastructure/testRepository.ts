import { TestEntity } from "../domain/entities/test.entity.js";
import { type ITestRepository } from "../domain/repositories/test.repository.js";
import { type TestEntityProps } from "../domain/entities/test.entity.js";

export class TestRepository implements ITestRepository {
    private tests: Map<string, TestEntity> = new Map();

    async test(test: TestEntityProps): Promise<void> {
        const entity = new TestEntity(test);
        this.tests.set(entity.id, entity);
    }

    async test1(id: string): Promise<TestEntity | null> {
        return this.tests.get(id) ?? null;
    }
}

