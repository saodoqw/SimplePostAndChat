const POST_CONTENT_MAX_LENGTH = 1000;

export class PostEntityValidationError extends Error {
    constructor(message: string){
        super(message);
        this.name = "PostEntityValidationError";
    }
}
interface PostEntityProps{
    id: string;
    author_id: string;
    content: string;
    created_at: Date;
    updated_at: Date;
}

export class PostEntity{
    readonly id: string;
    readonly author_id: string
    readonly content: string;
    readonly created_at: Date;
    readonly updated_at: Date;

    constructor(props: PostEntityProps){
        PostEntity.validateForCreation(props.content, props.author_id  );
        this.id = props.id;
        this.author_id = props.author_id;
        this.content = props.content.trim();
        this.created_at = props.created_at;
        this.updated_at = props.updated_at;
    }

    static validateForCreation(content: string,author_id: string): void{
        const normalizedContent = content.trim();
        const normalizedAuthorId = author_id.trim();
        if(!normalizedContent.length){
            throw new PostEntityValidationError("Post content cannot be empty.");
        }
        if(normalizedContent.length > POST_CONTENT_MAX_LENGTH){
            throw new PostEntityValidationError(`Post content cannot exceed ${POST_CONTENT_MAX_LENGTH} characters.`);
        }
        if(!normalizedAuthorId.length){
            throw new PostEntityValidationError("Author ID cannot be empty.");
        }
    }
}