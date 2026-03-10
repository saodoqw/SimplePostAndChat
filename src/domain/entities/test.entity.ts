import e from "express";

export class TestEntity {
    id: string;
    name: string;

    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
    }

    validate(): void {
        if (!this.name || this.name.trim() === "") {
            throw new Error("Name is required");
        }
        if (this.name.length > TEST_NAME_MAX_LENGTH) {
            throw new Error(`Name must not exceed ${TEST_NAME_MAX_LENGTH} characters`);
        }
    }

}
export type testDTO = {
    name: string;
}
 const TEST_NAME_MAX_LENGTH = 100;