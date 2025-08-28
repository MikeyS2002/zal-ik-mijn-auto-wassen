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
        <main className="h-screen relative">
            <div className="fixed z-10 top-[120px] max-w-[650px] left-1/2 -translate-x-1/2 text-center px-4">
                <h1 className="h2 text-white drop-shadow-lg">
                    {adviceData.decision === "JA" ? "Ja" : "Nee"},{" "}
                    {adviceData.decision === "JA"
                        ? "je kan vandaag je auto wassen"
                        : "was je auto vandaag niet"}
                </h1>
                <h2 className="body mt-4 text-white drop-shadow-md bg-black bg-opacity-30 p-4 rounded-lg">
                    {adviceData.reason}
                </h2>
            </div>

            <div className="bg-gradient-to-br from-blue-400 to-blue-600 h-full w-full flex items-center justify-center">
                <div className="text-white text-center">
                    <div className="text-6xl mb-4">🚗</div>
                    <div className="text-2xl font-bold">Auto Wasadvies</div>
                </div>
            </div>
        </main>
    );
}
