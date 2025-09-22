import React from "react";
import Images from "@/components/Images";
import { createClient } from "redis";

// Make it dynamic so it always fetches fresh data
export const dynamic = "force-dynamic";

// Function to get Redis client
async function getRedisClient() {
    if (!process.env.KV_REDIS_URL) {
        throw new Error("Redis URL not configured");
    }

    const redis = createClient({
        url: process.env.KV_REDIS_URL,
    });
    await redis.connect();
    return redis;
}

// Get advice data from Redis
async function getAdviceData() {
    let redis = null;

    try {
        redis = await getRedisClient();
        const storedData = await redis.get("daily-advice");

        if (storedData) {
            const parsed = JSON.parse(storedData);
            return parsed.advice;
        }

        return null;
    } catch (error) {
        console.error("Error fetching from Redis:", error);
        return null;
    } finally {
        if (redis) {
            await redis.quit();
        }
    }
}

export default async function Home() {
    // Fetch advice data
    let adviceData = await getAdviceData();

    // Fallback if no data
    if (!adviceData) {
        adviceData = {
            decision: "NEE",
            reason: "Er is een fout opgelopen. We kunnen het weer momenteel niet checken.",
            reasonCategory: "ERROR",
        };
    }

    return (
        <main className="h-screen relative">
            <div className="fixed z-10 top-[120px] max-w-[650px] w-full left-1/2 -translate-x-1/2 text-center px-4">
                <h1 className="h2">
                    {adviceData.decision === "JA"
                        ? "Ja, je kan vandaag je auto wassen."
                        : "Nee, het is niet handig om vandaag je auto te wassen."}
                </h1>

                <h2 className="body mt-4">
                    {adviceData.reason}
                    <svg
                        width="20"
                        height="18"
                        viewBox="0 0 20 18"
                        fill="none"
                        className="inline cursor-pointer ml-1"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M9.99999 6.06624L10 6M9.99999 14L9.99999 9"
                            stroke="#373737"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <path
                            d="M17.5451 12.1999L12.6953 3.79986C11.7859 2.22468 11.331 1.43722 10.7373 1.17291C10.2195 0.942364 9.62783 0.942364 9.11002 1.17291C8.51661 1.43711 8.06197 2.22458 7.15329 3.79845L2.30273 12.1999C1.3933 13.775 0.938715 14.5629 1.00664 15.2092C1.06589 15.7729 1.36175 16.2851 1.82031 16.6182C2.34586 17.0001 3.25473 17.0001 5.07236 17.0001H14.7753C16.5929 17.0001 17.5017 17.0001 18.0272 16.6182C18.4858 16.2851 18.7818 15.7729 18.841 15.2092C18.9089 14.5629 18.4545 13.775 17.5451 12.1999Z"
                            stroke="#373737"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </h2>
            </div>

            <Images adviceData={adviceData} />
        </main>
    );
}
