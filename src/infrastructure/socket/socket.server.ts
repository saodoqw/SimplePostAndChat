import { type Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { registerChatSocket } from "./chat.socket.js";

export function initializeSocketServer(httpServer: HttpServer): Server {
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.SOCKET_CORS_ORIGIN ?? "*",
            credentials: true,
        },
    });
    io.on("connection", (socket) => {
        console.log("User connected:", socket.id);

        socket.on("disconnect", () => {
            console.log("User disconnected:", socket.id);
        });
    });

    registerChatSocket(io);
    return io;
}
