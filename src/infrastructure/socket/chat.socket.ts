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

interface IncomingMediaFilePayload {
    filename: string;
    mimetype: string;
    dataBase64: string;
}

interface SendMessagePayload {
    conversationId: string;
    content?: string;
    mediaFiles?: IncomingMediaFilePayload[];
}

interface SendMessageFileInput {
    buffer: Buffer;
    filename: string;
    mimetype: string;
}

const chatRepository = new PrismaChatRepository();
const userRepository = new PrismaUserRepository();
const chatUseCase = new ChatUseCase(chatRepository, cloudinaryService, userRepository);

export function registerChatSocket(io: Server): void {
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

        authedSocket.on("message:send", async (payload: SendMessagePayload, ack?: SocketAck) => {
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

                const mediaFiles = mapIncomingMediaFiles(payload.mediaFiles);
                const createdMessage = await chatUseCase.sendMessage(
                    conversationId,
                    authedSocket.data.authUser.userId,
                    payload.content,
                    mediaFiles,
                );

                const messagePayload = normalizeCreatedMessage(createdMessage);
                io.to(getConversationRoom(conversationId)).emit("message:new", {
                    conversationId,
                    ...messagePayload,
                });

                ack?.({ ok: true, data: messagePayload });
            } catch (error) {
                ack?.({ ok: false, error: toErrorMessage(error) });
            }
        });
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

function mapIncomingMediaFiles(mediaFiles?: IncomingMediaFilePayload[]): SendMessageFileInput[] | undefined {
    if (!mediaFiles?.length) {
        return undefined;
    }

    const normalizedFiles = mediaFiles
        .map((file) => ({
            filename: file.filename?.trim() ?? "",
            mimetype: file.mimetype?.trim() ?? "",
            dataBase64: file.dataBase64?.trim() ?? "",
        }))
        .filter((file) => file.filename && file.mimetype && file.dataBase64)
        .map((file) => ({
            filename: file.filename,
            mimetype: file.mimetype,
            buffer: Buffer.from(file.dataBase64, "base64"),
        }))
        .filter((file) => file.buffer.length > 0);

    return normalizedFiles.length ? normalizedFiles : undefined;
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
