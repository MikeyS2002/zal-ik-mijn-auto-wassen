import { kv } from "@vercel/kv";

export async function GET() {
    try {
        const todayKey = `advice:${new Date().toISOString().slice(0, 10)}`;
        const stored = await kv.get(todayKey);

        if (stored && isToday(stored.date)) {
            return Response.json({
                success: true,
                advice: stored.advice,
                weather: stored.weather,
                lastUpdated: stored.date,
            });
        }

        // Not in KV or outdated -> call daily-update to refresh
        const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "http://localhost:3000";

        const response = await fetch(`${baseUrl}/api/daily-update`, {
            cache: "no-store",
        });
        if (!response.ok) throw new Error("Daily update API failed");
        const data = await response.json();

        const payload = {
            date: new Date().toISOString(),
            advice: data.advice,
            weather: data.weather,
        };

        await kv.set(todayKey, payload, { ex: 60 * 60 * 30 });
        await kv.set("advice:latest", payload, { ex: 60 * 60 * 30 });

        return Response.json({
            success: true,
            advice: data.advice,
            weather: data.weather,
            lastUpdated: payload.date,
        });
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

function isToday(dateISO) {
    const d = new Date(dateISO);
    const now = new Date();
    return d.toDateString() === now.toDateString();
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
