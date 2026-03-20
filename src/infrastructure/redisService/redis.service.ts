import "dotenv/config";
import { Redis } from "@upstash/redis";
import { pathToFileURL } from "url";

export interface RedisService {
    set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
    get<T>(key: string): Promise<T | null>;
    del(key: string): Promise<void>;
}

class RedisServiceImpl implements RedisService {
    private readonly client: Redis;

    constructor() {
        const url = process.env.UPSTASH_REDIS_REST_ENDPOINT;
        const token = process.env.UPSTASH_REDIS_TOKKEN;

        if (!url || !token) {
            throw new Error(
                "Missing Upstash credentials. Set UPSTASH_REDIS_REST_ENDPOINT and UPSTASH_REDIS_TOKKEN in environment variables."
            );
        }

        this.client = new Redis({ url, token });
    }

    async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
        if (ttlSeconds !== undefined) {
            await this.client.set(key, value, { ex: ttlSeconds });
        } else {
            await this.client.set(key, value);
        }
    }

    async get<T>(key: string): Promise<T | null> {
        return this.client.get<T>(key);
    }

    async del(key: string): Promise<void> {
        await this.client.del(key);
    }
}

export const redisService = new RedisServiceImpl();

const currentFileArg = process.argv[1];
if (currentFileArg && import.meta.url === pathToFileURL(currentFileArg).href) {
    (async () => {
        await redisService.set("health:redis", "ok", 30);
        const value = await redisService.get<string>("health:redis");
        console.log("Redis test value:", value);
        await redisService.del("health:redis");
    })().catch((error: unknown) => {
        console.error("Redis test failed:", error);
        process.exit(1);
    });
}

