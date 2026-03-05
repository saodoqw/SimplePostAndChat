import { PrismaClient } from "./prisma/generated";

const prisma = new PrismaClient();

async function testConnection(): Promise<void> {
    try {
        await prisma.$connect();
        console.log("✓ Database connection successful");
    } catch (error) {
        console.error("✗ Database connection failed:", error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

testConnection();