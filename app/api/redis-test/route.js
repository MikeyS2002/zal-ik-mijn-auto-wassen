// app/api/redis-test/route.js
import { createClient } from "redis";
import { NextResponse } from "next/server";

export async function GET() {
    let redis = null;

    try {
        // Create Redis client with your connection string
        redis = createClient({
            url: process.env.KV_REDIS_URL, // This uses the redis:// URL from your env
        });

        // Connect to Redis
        await redis.connect();
        console.log("Connected to Redis successfully");

        // Test: Set and get a value
        await redis.set("test-item", "Hello from Redis!");
        const result = await redis.get("test-item");

        console.log("Redis result:", result);

        return NextResponse.json({
            success: true,
            result,
            message: "Redis connection working!",
        });
    } catch (error) {
        console.error("Redis error:", error);

        return NextResponse.json(
            {
                success: false,
                error: error.message,
                details: {
                    hasRedisUrl: !!process.env.KV_REDIS_URL,
                    nodeEnv: process.env.NODE_ENV,
                },
            },
            { status: 500 }
        );
    } finally {
        // Always close the connection
        if (redis && redis.isReady) {
            await redis.quit();
        }
    }
}
