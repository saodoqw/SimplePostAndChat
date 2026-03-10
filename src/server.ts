import "dotenv/config";
import app from "./app.js";
import { prisma } from "./infrastructure/database/prisma/prismaClient.js";

const port = Number(process.env.PORT ?? 3000);

async function bootstrap(): Promise<void> {
    await prisma.$connect();

    app.listen(port, () => {
        console.log(`Server listening on port ${port}`);
    });
}

void bootstrap().catch(async (error: unknown) => {
    console.error("Failed to start server:", error);
    await prisma.$disconnect();
    process.exit(1);
});