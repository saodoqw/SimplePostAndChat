
export interface TestEntityProps {
    id: string;
    name: string;
}
export class TestEntity {
    id: string;
    name: string;

    constructor(props: TestEntityProps) {
        this.id = props.id;
        this.name = props.name;
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