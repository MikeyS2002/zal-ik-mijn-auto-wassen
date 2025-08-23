// app/api/todays-advice/route.js
import { promises as fs } from "fs";
import path from "path";

// File path to store daily advice
const ADVICE_FILE = path.join(process.cwd(), "data", "daily-advice.json");

export async function GET() {
    try {
        // Check if advice file exists
        try {
            const fileContent = await fs.readFile(ADVICE_FILE, "utf8");
            const storedAdvice = JSON.parse(fileContent);

            // Check if advice is from today
            const today = new Date().toDateString();
            const adviceDate = new Date(storedAdvice.date).toDateString();

            if (today === adviceDate) {
                // Return today's stored advice
                return Response.json({
                    success: true,
                    advice: storedAdvice.advice,
                    weather: storedAdvice.weather,
                    lastUpdated: storedAdvice.date,
                });
            } else {
                // Advice is from yesterday or older, get fresh advice
                console.log("Stored advice is outdated, fetching fresh advice");
                return await getFreshAdvice();
            }
        } catch (fileError) {
            // File doesn't exist or is corrupted, get fresh advice
            console.log("No stored advice found, fetching fresh advice");
            return await getFreshAdvice();
        }
    } catch (error) {
        console.error("Error in todays-advice API:", error);
        return Response.json(
            {
                success: false,
                error: "Failed to get advice",
                advice: getEmergencyAdvice(),
            },
            { status: 500 }
        );
    }
}

// Get fresh advice by calling the daily-update endpoint
async function getFreshAdvice() {
    try {
        // Call our existing daily-update API
        const baseUrl = process.env.VERCEL_URL
            ? `${process.env.VERCEL_URL}`
            : "http://localhost:3000";

        const response = await fetch(`${baseUrl}/api/daily-update`);

        if (!response.ok) {
            throw new Error("Daily update API failed");
        }

        const data = await response.json();

        // Store the fresh advice
        await storeAdvice(data.advice, data.weather);

        return Response.json({
            success: true,
            advice: data.advice,
            weather: data.weather,
            lastUpdated: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Error getting fresh advice:", error);
        return Response.json(
            {
                success: false,
                error: "Failed to get fresh advice",
                advice: getEmergencyAdvice(),
            },
            { status: 500 }
        );
    }
}

// Store advice to file
async function storeAdvice(advice, weather) {
    try {
        // Ensure data directory exists
        const dataDir = path.join(process.cwd(), "data");
        try {
            await fs.access(dataDir);
        } catch {
            await fs.mkdir(dataDir, { recursive: true });
        }

        const adviceData = {
            date: new Date().toISOString(),
            advice,
            weather,
        };

        await fs.writeFile(ADVICE_FILE, JSON.stringify(adviceData, null, 2));
        console.log("Advice stored successfully");
    } catch (error) {
        console.error("Error storing advice:", error);
    }
}

// Emergency fallback advice when everything fails
function getEmergencyAdvice() {
    return {
        decision: "MAYBE",
        reason: "We kunnen het weer momenteel niet checken. Is het droog en niet te koud of warm? Dan kun je waarschijnlijk wassen.",
        reasonCategory: null,
        confidence: "LOW",
        randomNumber: Math.floor(Math.random() * 4) + 1,
        analysis: {
            goodFactors: [],
            badFactors: ["Geen weerdata beschikbaar"],
            warnings: ["Check zelf het weer voordat je gaat wassen"],
        },
    };
}
