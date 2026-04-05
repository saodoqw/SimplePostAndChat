import { type NextFunction, type Request, type Response } from "express";
import { type AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { ChatUseCase } from "../../application/usecases/chats/chats.usecases.js";
import { type MessageEntity } from "../../domain/entities/message.entity.js";

type OnMessageCreated = (conversationId: string, message: MessageEntity) => void;

export class ChatController {
    constructor(
        private chatUseCase: ChatUseCase,
        private readonly onMessageCreated?: OnMessageCreated,
    ) { }

    createDirectConversation = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const authUser = (req as AuthenticatedRequest).authUser;
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }

            const recipientId = this.getBodyString(req.body?.recipientId).trim();
            if (!recipientId) {
                res.status(400).json({ message: "Recipient ID is required" });
                return;
            }

            const conversation = await this.chatUseCase.findOrCreateDirectConversation(authUser.userId, recipientId);
            res.status(200).json({ data: conversation });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };
    createGroupConversation = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const authUser = (req as AuthenticatedRequest).authUser;
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            const groupName = this.getBodyString(req.body?.name).trim();
            const userIds = req.body?.userIds;
            if (!Array.isArray(userIds) || userIds.length === 0) {
                res.status(400).json({ message: "At least one user ID is required" });
                return;
            }
            const conversation = await this.chatUseCase.createGroupChat(authUser.userId, userIds, groupName);
            res.status(201).json({ data: conversation });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };

    changeGroupName = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const authUser = (req as AuthenticatedRequest).authUser;
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            const conversationId = this.getParamString(req.params.conversationId).trim();
            const newName = this.getBodyString(req.body?.name).trim();
            if (!conversationId) {
                res.status(400).json({ message: "Conversation ID is required" });
                return;
            }
            if (!newName) {
                res.status(400).json({ message: "New group name is required" });
                return;
            }
            const conversation = await this.chatUseCase.updateGroupName(conversationId, authUser.userId, newName);
            res.status(200).json({ data: conversation });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };
    deleteConversation = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const authUser = (req as AuthenticatedRequest).authUser;
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            const conversationId = this.getParamString(req.params.conversationId).trim();
            if (!conversationId) {
                res.status(400).json({ message: "Conversation ID is required" });
                return;
            }
            await this.chatUseCase.deleteConversation(conversationId, authUser.userId);
            res.status(200).json({ message: "Conversation deleted successfully" });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };
    displayUserConversations = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const authUser = (req as AuthenticatedRequest).authUser;
            const cursor = this.getQueryString(req.query?.cursor);
            const limit = this.getQueryNumber(req.query?.limit, 10);

            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            const conversations = await this.chatUseCase.listUserConversations(
                authUser.userId,
                limit,
                cursor
            );
            res.status(200).json({ data: conversations });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };
    getConversationDetails = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const authUser = (req as AuthenticatedRequest).authUser;
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            const conversationId = this.getParamString(req.params.conversationId).trim();
            if (!conversationId) {
                res.status(400).json({ message: "Conversation ID is required" });
                return;
            }
            const conversationDetails = await this.chatUseCase.displayConversationDetails(conversationId, authUser.userId);
            res.status(200).json({ data: conversationDetails });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    }
    addUsersToGroup = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const authUser = (req as AuthenticatedRequest).authUser;
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            const conversationId = this.getParamString(req.params.conversationId).trim();
            const userIdToAdd = this.getBodyStringArray(req.body?.userIdToAdd);

            if (!conversationId) {
                res.status(400).json({ message: "Conversation ID is required" });
                return;
            }
            if (!userIdToAdd) {
                res.status(400).json({ message: "userIdToAdd is required" });
                return;
            }

            const conversation = await this.chatUseCase.addParticipants(
                conversationId,
                authUser.userId,
                userIdToAdd,
            );
            res.status(200).json({ message: "Users added to group successfully" });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };

    removeUsersFromGroup = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const authUser = (req as AuthenticatedRequest).authUser;
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            const conversationId = this.getParamString(req.params.conversationId).trim();
            const userIdToRemove = this.getBodyStringArray(req.body?.userIdToRemove);
            if (!conversationId) {
                res.status(400).json({ message: "Conversation ID is required" });
                return;
            }
            if (!userIdToRemove) {
                res.status(400).json({ message: "userIdToRemove is required" });
                return;
            }
            const conversation = await this.chatUseCase.removeParticipants(
                conversationId,
                authUser.userId,
                userIdToRemove,
            );
            res.status(200).json({ message: "Users removed from group successfully" });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    }
    leaveGroup = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const authUser = (req as AuthenticatedRequest).authUser;
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            const conversationId = this.getParamString(req.params.conversationId).trim();
            if (!conversationId) {
                res.status(400).json({ message: "Conversation ID is required" });
                return;
            }
            await this.chatUseCase.leaveConversation(conversationId, authUser.userId);
            res.status(200).json({ message: "Left conversation successfully" });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };
    grantAdmin = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const authUser = (req as AuthenticatedRequest).authUser;
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            const conversationId = this.getParamString(req.params.conversationId).trim();
            const userIdToGrant = this.getBodyString(req.body?.userIdToGrant).trim();
            if (!conversationId) {
                res.status(400).json({ message: "Conversation ID is required" });
                return;
            }
            if (!userIdToGrant) {
                res.status(400).json({ message: "userIdToGrant is required" });
                return;
            }
            await this.chatUseCase.transferGroupAdmin(conversationId, authUser.userId, userIdToGrant);
            res.status(200).json({ message: "Transferred admin successfully" });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };


    sendMessage = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            console.log("[CHAT_DEBUG] sendMessage called - conversationId:", req.params.conversationId);
            const authUser = (req as AuthenticatedRequest).authUser;
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }

            const conversationId = this.getParamString(req.params.conversationId).trim();
            if (!conversationId) {
                res.status(400).json({ message: "Conversation ID is required" });
                return;
            }

            const content = this.getBodyString(req.body?.content);
            const mediaFiles = this.getMediaFiles(req);


            if (!content && !mediaFiles?.length) {
                res.status(400).json({ message: "Content or media is required" });
                return;
            }

            const message = await this.chatUseCase.sendMessage(
                conversationId,
                authUser.userId,
                content,
                mediaFiles,
            );

            this.onMessageCreated?.(conversationId, message);
            res.status(201).json({ data: message });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };

    // displayMessages = async (
    //     req: Request,
    //     res: Response,
    //     next: NextFunction,
    // ): Promise<void> => {
    //     try {
    //         const authUser = (req as AuthenticatedRequest).authUser;
    //         if (!authUser?.userId) {
    //             res.status(401).json({ message: "Unauthorized" });
    //             return;
    //         }

    //         const conversationId = this.getParamString(req.params.conversationId).trim();
    //         if (!conversationId) {
    //             res.status(400).json({ message: "Conversation ID is required" });
    //             return;
    //         }

    //         const isMember = await this.chatUseCase.isUserInConversation(conversationId, authUser.userId);
    //         if (!isMember) {
    //             res.status(403).json({ message: "Forbidden: user is not in conversation" });
    //             return;
    //         }

    //         const messages = await this.chatUseCase.displayMessages(conversationId);
    //         res.status(200).json({ data: messages });
    //     } catch (error) {
    //         res.status(400).json({ message: (error as Error).message });
    //         next(error);
    //     }
    // };

    paginateMessages = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const authUser = (req as AuthenticatedRequest).authUser;
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }

            const conversationId = this.getParamString(req.params.conversationId).trim();
            if (!conversationId) {
                res.status(400).json({ message: "Conversation ID is required" });
                return;
            }

            const isMember = await this.chatUseCase.isUserInConversation(conversationId, authUser.userId);
            if (!isMember) {
                res.status(403).json({ message: "Forbidden: user is not in conversation" });
                return;
            }

            const limit = this.getQueryNumber(req.query?.limit, 20);
            const cursor = this.getQueryString(req.query?.cursor);
            const search = this.getQueryString(req.query?.search);
            const direction = this.getDirection(req.query?.direction);

            const messages = await this.chatUseCase.paginateMessages(
                conversationId,
                limit,
                cursor,
                search,
                direction,
            );

            res.status(200).json({ data: messages });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };

    updateMessage = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const authUser = (req as AuthenticatedRequest).authUser;
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            const conversationId = this.getParamString(req.params.conversationId).trim();
            const messageId = this.getParamString(req.params.messageId).trim();
            const newContent = this.getBodyString(req.body?.content);
            if (!conversationId) {
                res.status(400).json({ message: "Conversation ID is required" });
                return;
            }
            if (!messageId) {
                res.status(400).json({ message: "Message ID is required" });
                return;
            }
            if (!newContent) {
                res.status(400).json({ message: "New content is required" });
                return;
            }
            const updatedMessage = await this.chatUseCase.updateMessage(
                conversationId,
                authUser.userId,
                messageId,
                newContent,
            );
            res.status(200).json({ data: updatedMessage });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };
    deleteMessage = async (
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const authUser = (req as AuthenticatedRequest).authUser;
            if (!authUser?.userId) {
                res.status(401).json({ message: "Unauthorized" });
                return;
            }
            const conversationId = this.getParamString(req.params.conversationId).trim();
            const messageId = this.getParamString(req.params.messageId).trim();
            if (!conversationId) {
                res.status(400).json({ message: "Conversation ID is required" });
                return;
            }
            if (!messageId) {
                res.status(400).json({ message: "Message ID is required" });
                return;
            }
            await this.chatUseCase.deleteMessage(conversationId, authUser.userId, messageId);
            res.status(200).json({ message: "Message deleted successfully" });
        } catch (error) {
            res.status(400).json({ message: (error as Error).message });
            next(error);
        }
    };


    private getBodyString(value: unknown): string {
        return typeof value === "string" ? value : "";
    }

    private getBodyStringArray(value: unknown): string[] {
        if (!Array.isArray(value)) {
            return [];
        }
        return value
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
    }

    private getParamString(value: unknown): string {
        return typeof value === "string" ? value : "";
    }
    private getQueryString(value: unknown): string | undefined {
        const parsed = this.getBodyString(value).trim();
        return parsed || undefined;
    }

    private getQueryNumber(value: unknown, defaultValue: number): number {
        const parsed = Number(this.getBodyString(value));
        if (!Number.isInteger(parsed) || parsed <= 0) {
            return defaultValue;
        }
        return parsed;
    }

    private getDirection(value: unknown): "up" | "down" | undefined {
        const parsed = this.getBodyString(value);
        if (parsed === "up" || parsed === "down") {
            return parsed;
        }
        return undefined;
    }

    private getMediaFiles(req: Request): { buffer: Buffer; filename: string; mimetype: string }[] | undefined {
        if (!req.files) {
            return undefined;
        }

        if (Array.isArray(req.files)) {
            return req.files.map((file) => ({
                buffer: file.buffer,
                filename: file.originalname,
                mimetype: file.mimetype,
            }));
        }

        const mergedMediaFiles = [
            ...(Array.isArray(req.files.images) ? req.files.images : []),
            ...(Array.isArray(req.files.videos) ? req.files.videos : []),
        ];

        if (!mergedMediaFiles.length) {
            return undefined;
        }

        return mergedMediaFiles.map((file) => ({
            buffer: file.buffer,
            filename: file.originalname,
            mimetype: file.mimetype,
        }));
    }
}
