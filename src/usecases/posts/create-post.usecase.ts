import {
    PostEntity,
    PostEntityValidationError,
} from "../../domain/entities/post.entity.js";
import {
    type PostRepository,
} from "../../domain/repositories/post.repository.js";

export interface CreatePostUseCaseInput {
    authorId: string;
    content: string;
}

export type CreatePostUseCaseOutput = PostEntity;

export class CreatePostValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CreatePostValidationError";
    }
}

export class CreatePostUseCase {
    constructor(private readonly postRepository: PostRepository) {}

    async execute(input: CreatePostUseCaseInput): Promise<CreatePostUseCaseOutput> {
        const authorId = input.authorId.trim();
        const content = input.content.trim();

        try {
            PostEntity.validateForCreation(authorId, content);
        } catch (error) {
            if (error instanceof PostEntityValidationError) {
                throw new CreatePostValidationError(error.message);
            }

            throw error;
        }

        return this.postRepository.create({
            authorId,
            content,
        });
    }
}