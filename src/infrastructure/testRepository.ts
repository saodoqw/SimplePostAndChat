import { TestEntity } from "../domain/entities/test.entity.js";
import {type ITestRepository} from "../domain/repositories/test.repository.js";
import type { testDTO } from "../domain/entities/test.entity.js";

export class TestRepository implements ITestRepository {
    private tests: Map<string, TestEntity> = new Map();

    async test(test: testDTO): Promise<void> {
        const entity = new TestEntity(crypto.randomUUID(), test.name);
        this.tests.set(entity.id, entity);
    }

    async test1(id: string): Promise<TestEntity | null> {
        return this.tests.get(id) ?? null;
    }
}

