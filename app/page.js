import React from "react";
import Image from "next/image";
import { createClient } from "redis";

// Cache de pagina, maar revalidate als Redis data verandert
export const revalidate = 300;

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

// Generate cache tag based on advice date
function getCacheTag(storedData) {
    if (!storedData) return "no-advice";

    try {
        const parsed = JSON.parse(storedData);
        const date = new Date(parsed.date).toDateString();
        return `advice-${date}`;
    } catch {
        return "invalid-advice";
    }
}

export default async function Home() {
    let adviceData = null;
    let redis = null;
    let cacheTag = "no-advice";

    try {
        console.log("Connecting to Redis...");
        redis = await getRedisClient();

        if (redis) {
            console.log("Fetching advice from Redis...");
            const storedData = await redis.get("daily-advice");
            cacheTag = getCacheTag(storedData);

            if (storedData) {
                const parsed = JSON.parse(storedData);
                const storedDate = new Date(parsed.date).toDateString();
                const today = new Date().toDateString();

                if (storedDate === today) {
                    // Advice is van vandaag - gebruik het
                    adviceData = parsed.advice;
                    console.log(
                        "Using fresh advice from Redis:",
                        adviceData.decision
                    );
                } else {
                    // Advice is oud - trigger nieuwe update
                    console.log(
                        "Stored advice is from",
                        storedDate,
                        "but today is",
                        today
                    );
                    console.log("Triggering fresh daily update...");

                    const baseUrl = process.env.VERCEL_URL
                        ? `https://${process.env.VERCEL_URL}`
                        : "http://localhost:3000";

                    try {
                        const response = await fetch(
                            `${baseUrl}/api/daily-update`,
                            {
                                cache: "no-store",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                            }
                        );

                        if (response.ok) {
                            const data = await response.json();
                            if (data.success) {
                                adviceData = data.advice;
                                cacheTag = `advice-${new Date().toDateString()}`;
                                console.log(
                                    "Generated new advice:",
                                    adviceData.decision
                                );

                                // Revalidate cache voor deze nieuwe data
                                if (process.env.NODE_ENV === "production") {
                                    console.log(
                                        "New advice generated, cache will revalidate"
                                    );
                                }
                            }
                        }
                    } catch (fetchError) {
                        console.error(
                            "Failed to fetch new advice:",
                            fetchError
                        );
                        // Gebruik oude advice als fallback
                        adviceData = parsed.advice;
                    }
                }
            } else {
                console.log("No advice in Redis, generating first time...");

                const baseUrl = process.env.VERCEL_URL
                    ? `https://${process.env.VERCEL_URL}`
                    : "http://localhost:3000";

                try {
                    const response = await fetch(
                        `${baseUrl}/api/daily-update`,
                        {
                            cache: "no-store",
                        }
                    );

                    if (response.ok) {
                        const data = await response.json();
                        if (data.success) {
                            adviceData = data.advice;
                            cacheTag = `advice-${new Date().toDateString()}`;
                        }
                    }
                } catch (fetchError) {
                    console.error(
                        "Failed to generate initial advice:",
                        fetchError
                    );
                }
            }
        } else {
            console.log("Redis not available, using direct API...");

            const baseUrl = process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}`
                : "http://localhost:3000";

            const response = await fetch(`${baseUrl}/api/daily-update`, {
                cache: "no-store",
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    adviceData = data.advice;
                    cacheTag = `advice-${new Date().toDateString()}`;
                }
            }
        }
    } catch (error) {
        console.error("Error in homepage:", error.message);

        // Laatste fallback - probeer alsnog oude data uit Redis
        if (redis) {
            try {
                const storedData = await redis.get("daily-advice");
                if (storedData) {
                    const parsed = JSON.parse(storedData);
                    adviceData = parsed.advice;
                    console.log("Using emergency fallback advice");
                }
            } catch (fallbackError) {
                console.error("Emergency fallback failed:", fallbackError);
            }
        }
    } finally {
        if (redis && redis.isReady) {
            await redis.quit();
        }
    }

    // Ultimate fallback
    if (!adviceData) {
        adviceData = {
            decision: "NEE",
            reason: "Er is een fout opgelopen. We kunnen het weer momenteel niet checken.",
            reasonCategory: "STORM",
            randomNumber: 1,
        };
        cacheTag = "fallback-advice";
    }

    console.log(`Using cache tag: ${cacheTag}`);
    console.log("Final advice:", adviceData);

    return (
        <main className="h-screen relative">
            {/* Hidden div with cache tag for debugging */}
            <div className="hidden" data-cache-tag={cacheTag}></div>

            <div className="fixed z-10 top-[120px] max-w-[650px] w-full left-1/2 -translate-x-1/2 text-center px-4">
                <h1 className="h2">
                    {adviceData.decision === "JA"
                        ? "Ja, je kan vandaag je auto wassen."
                        : "Nee, het is niet handig om vandaag je auto te wassen."}
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
                        className="w-full select-none pointer-events-none hidden sm:block h-full object-cover absolute top-0 left-0"
                    />
                    <Image
                        alt="Je kan vandaag je auto wassen"
                        src={`/images/ja/mobile-ja-${adviceData.randomNumber}.jpg`}
                        width={800}
                        priority
                        height={1200}
                        className="w-full select-none pointer-events-none sm:hidden block h-full object-cover absolute top-0 left-0"
                    />
                </>
            )}

            {adviceData.decision === "NEE" && (
                <>
                    <Image
                        alt="Je kan vandaag niet je auto wassen"
                        src={`/images/nee/desktop-nee-${adviceData.reasonCategory}.jpg`}
                        width={2500}
                        priority
                        height={1800}
                        className="w-full select-none pointer-events-none hidden sm:block h-full object-cover absolute top-0 left-0"
                    />
                    <Image
                        alt="Je kan vandaag niet je auto wassen"
                        src={`/images/nee/mobile-nee-${adviceData.reasonCategory}.jpg`}
                        width={800}
                        priority
                        height={1200}
                        className="w-full select-none pointer-events-none sm:hidden block h-full object-cover absolute top-0 left-0"
                    />
                </>
            )}
        </main>
    );
}
