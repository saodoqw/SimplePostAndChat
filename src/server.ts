import "dotenv/config";
import { createServer } from "node:http";
import app from "./app.js";
import { prisma } from "./infrastructure/database/prisma/prismaClient.js";
import { initializeSocketServer } from "./infrastructure/socket/socket.server.js";

const port = Number(process.env.PORT ?? 3000);

async function bootstrap(): Promise<void> {
    await prisma.$connect();
    // Initialize Socket.IO server
    const httpServer = createServer(app);
    initializeSocketServer(httpServer);
    // Start the HTTP server with Socket.IO
    httpServer.listen(port, () => {
        console.log(`Server listening on port ${port}`);
    });
}

void bootstrap().catch(async (error: unknown) => {
    console.error("Failed to start server:", error);
    await prisma.$disconnect();
    process.exit(1);
});