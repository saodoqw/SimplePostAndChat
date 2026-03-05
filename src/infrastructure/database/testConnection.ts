import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./prisma/generated/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL is missing. Add it to your .env file.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function testConnection(): Promise<void> {
    try {
        await prisma.$connect();
        await prisma.$queryRaw`SELECT 1`;
        console.log("✓ Database connection successful");
    } catch (error) {
        console.error("✗ Database connection failed:", error);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

void testConnection();