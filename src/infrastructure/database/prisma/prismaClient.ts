import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL is missing. Add it to your .env file.");
}

const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({ adapter });