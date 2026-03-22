import { type Server, type Socket } from "socket.io";
import { type AccessTokenPayload, tokenService } from "../encryption/jwt.service.js";
import { cloudinaryService } from "../imageStorage/cloudinary/cloudinary.service.js";
import { PrismaChatRepository } from "../database/prisma/repositories/prisma-chat.repository.js";
import { PrismaUserRepository } from "../database/prisma/repositories/prisma-user.repository.js";
import { ChatUseCase } from "../../usecases/chats/chats.usecases.js";
import { type MessageEntity } from "../../domain/entities/message.entity.js";
import { type MessageWithMediaRepositoryResult } from "../../domain/repositories/chat.repository.js";

interface SocketSuccessResponse<T = unknown> {
    ok: true;
    data?: T;
}

interface SocketErrorResponse {
    ok: false;
    error: string;
}

type SocketAck<T = unknown> = (response: SocketSuccessResponse<T> | SocketErrorResponse) => void;

type AuthenticatedSocket = Socket<
    Record<string, never>,
    Record<string, never>,
    Record<string, never>,
    { authUser: AccessTokenPayload }
>;

interface ConversationRoomPayload {
    conversationId: string;
}

let activeIo: Server | null = null;

const chatRepository = new PrismaChatRepository();
const userRepository = new PrismaUserRepository();
const chatUseCase = new ChatUseCase(chatRepository, cloudinaryService, userRepository);

// This function registers all chat-related socket event handlers and middlewares
export function registerChatSocket(io: Server): void {
    activeIo = io;
    io.use((socket, next) => {
        try {
            const token = resolveAccessToken(socket);
            const authUser = tokenService.verifyAccessToken(token);
            (socket as AuthenticatedSocket).data.authUser = authUser;
            next();
        } catch {
            next(new Error("Unauthorized"));
        }
    });

    io.on("connection", (socket) => {
        const authedSocket = socket as AuthenticatedSocket;
        //create event handlers for joining/leaving conversation rooms
        //and sending messages and callback acks for success/error handling
        authedSocket.on("conversation:join", async (payload: ConversationRoomPayload, ack?: SocketAck) => {
            try {
                const conversationId = payload?.conversationId?.trim();
                if (!conversationId) {
                    throw new Error("conversationId is required");
                }

                const isMember = await chatUseCase.isUserInConversation(
                    conversationId,
                    authedSocket.data.authUser.userId,
                );

                if (!isMember) {
                    throw new Error("Forbidden: user is not in conversation");
                }

                authedSocket.join(getConversationRoom(conversationId));
                ack?.({ ok: true, data: { conversationId } });
            } catch (error) {
                ack?.({ ok: false, error: toErrorMessage(error) });
            }
        });

        authedSocket.on("conversation:leave", (payload: ConversationRoomPayload, ack?: SocketAck) => {
            try {
                const conversationId = payload?.conversationId?.trim();
                if (!conversationId) {
                    throw new Error("conversationId is required");
                }

                authedSocket.leave(getConversationRoom(conversationId));
                ack?.({ ok: true, data: { conversationId } });
            } catch (error) {
                ack?.({ ok: false, error: toErrorMessage(error) });
            }
        });
    });
}

export function emitNewMessageToConversation(
    conversationId: string,
    createdMessage: MessageEntity | MessageWithMediaRepositoryResult,
): void {
    const normalizedConversationId = conversationId.trim();
    if (!normalizedConversationId) {
        throw new Error("conversationId is required");
    }

    if (!activeIo) {
        return;
    }

    const messagePayload = normalizeCreatedMessage(createdMessage);
    activeIo.to(getConversationRoom(normalizedConversationId)).emit("message:new", {
        conversationId: normalizedConversationId,
        ...messagePayload,
    });
}

function resolveAccessToken(socket: Socket): string {
    const authToken = socket.handshake.auth.token;
    if (typeof authToken === "string" && authToken.trim()) {
        return authToken.trim();
    }

    const authorizationHeader = socket.handshake.headers.authorization;
    if (typeof authorizationHeader === "string") {
        const [scheme, token] = authorizationHeader.split(" ");
        if (scheme === "Bearer" && token) {
            return token.trim();
        }
    }

    throw new Error("Access token is required");
}

function getConversationRoom(conversationId: string): string {
    return `conversation:${conversationId}`;
}


function normalizeCreatedMessage(
    createdMessage: MessageEntity | MessageWithMediaRepositoryResult,
): MessageWithMediaRepositoryResult {
    if ("message" in createdMessage) {
        return createdMessage;
    }

    return {
        message: createdMessage,
        media: [],
    };
}

function toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Internal server error";
}
