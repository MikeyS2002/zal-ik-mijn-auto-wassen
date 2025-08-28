import React from "react";
import Image from "next/image";

import { createClient } from "redis";

// Function to get Redis client
async function getRedisClient() {
    if (!process.env.KV_REDIS_URL) {
        return null;
    }

    try {
        const redis = createClient({
            url: process.env.KV_REDIS_URL,
        });
        await redis.connect();
        return redis;
    } catch (error) {
        console.error("Failed to connect to Redis:", error);
        return null;
    }
}

export default async function Home() {
    let adviceData = null;
    let redis = null;

    try {
        console.log("Connecting to Redis...");
        redis = await getRedisClient();

        if (redis) {
            console.log("Fetching advice from Redis...");
            const storedData = await redis.get("daily-advice");

            if (storedData) {
                const parsed = JSON.parse(storedData);
                adviceData = parsed.advice;
                console.log("Found stored advice:", adviceData.decision);
                console.log(parsed);
            } else {
                console.log(
                    "No advice found in Redis, calling daily-update..."
                );
                // No stored advice, trigger daily update
                const response = await fetch(
                    "http://localhost:3000/api/daily-update"
                );
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        adviceData = data.advice;
                    }
                }
            }
        } else {
            console.log("Redis not available, using API fallback...");
            const response = await fetch(
                "http://localhost:3000/api/daily-update"
            );
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    adviceData = data.advice;
                }
            }
        }
    } catch (error) {
        console.error("Error:", error.message);
    } finally {
        if (redis && redis.isReady) {
            await redis.quit();
        }
    }

    console.log(adviceData);

    return (
        <main className="h-screen relativ">
            <div className="fixed z-10 top-[120px] max-w-[650px] w-full left-1/2 -translate-x-1/2 text-center px-4">
                <h1 className="h2">
                    {adviceData.decision === "JA"
                        ? "Ja, je kan vandaag je auto wassen."
                        : "Nee, het is neit handig om vandaag je auto te wassen."}
                </h1>
                <h2 className="body mt-4">{adviceData.reason}</h2>
            </div>
            {adviceData.decision === "JA" && (
                <>
                    <Image
                        alt="Je kan vandaag je auto wassen"
                        src={`/images/ja/desktop-ja-${adviceData.randomNumber}.jpg`}
                        width={2500}
                        priority
                        height={1800}
                        className="w-full select-none pointer-none hidden sm:block h-full object-cover absolute top-0 left-0"
                    />
                    <Image
                        alt="Je kan vandaag je auto wassen"
                        src={`/images/ja/mobile-ja-${adviceData.randomNumber}.jpg`}
                        width={800}
                        priority
                        height={1200}
                        className="w-full select-none pointer-none sm:hidden block h-full object-cover absolute top-0 left-0"
                    />
                </>
            )}
        </main>
    );
}
