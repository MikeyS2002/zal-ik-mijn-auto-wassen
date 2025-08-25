// app/api/todays-advice/route.js
import { Redis } from "@upstash/redis";

// Initialize Redis connection
const redis = new Redis({
    url: process.env.REDIS_URL,
    token: process.env.KV_REST_API_TOKEN,
});

export async function GET() {
    try {
        // Try to get stored advice from Redis
        const storedAdviceString = await redis.get("daily-advice");

        if (storedAdviceString) {
            const storedAdvice = JSON.parse(storedAdviceString);

            // Check if advice is from today
            const today = new Date().toDateString();
            const adviceDate = new Date(storedAdvice.date).toDateString();

            if (today === adviceDate) {
                console.log("Returning stored advice from Redis");
                return Response.json({
                    success: true,
                    advice: storedAdvice.advice,
                    weather: storedAdvice.weather,
                    lastUpdated: storedAdvice.date,
                    source: "redis-cache",
                });
            } else {
                console.log("Stored advice is outdated, fetching fresh advice");
            }
        } else {
            console.log(
                "No stored advice found in Redis, fetching fresh advice"
            );
        }

        // Get fresh advice if no stored advice or if it's outdated
        return await getFreshAdvice();
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

// Get fresh advice by calling weather API directly
async function getFreshAdvice() {
    try {
        // Import the weather service directly
        const { getWeatherData } = await import(
            "../../../lib/weatherServices.js"
        );

        // Get fresh weather data
        const weatherData = await getWeatherData("Amsterdam");

        // Make decision
        const washingAdvice = makeWashingDecision(weatherData);

        // Store in Redis for future requests today
        try {
            const adviceData = {
                date: new Date().toISOString(),
                advice: washingAdvice,
                weather: weatherData,
            };
            await redis.set("daily-advice", JSON.stringify(adviceData));
            console.log("Fresh advice stored in Redis");
        } catch (redisError) {
            console.error("Error storing fresh advice in Redis:", redisError);
        }

        return Response.json({
            success: true,
            advice: washingAdvice,
            weather: weatherData,
            lastUpdated: new Date().toISOString(),
            source: "fresh-api",
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

// Decision Logic: JA/NEE with smart contextual messages (copied from daily-update)
function makeWashingDecision(weather) {
    const goodFactors = [];
    const badFactors = [];
    const warnings = [];

    // Temperature analysis - use DAY temperature, not current morning temp
    if (weather.dayTemperature < 5) {
        badFactors.push({
            severity: "CRITICAL",
            factor: `Het wordt vandaag te koud (max ${weather.dayTemperature}°C). Wasproducten werken slecht en je auto droogt niet goed.`,
        });
    } else if (weather.dayTemperature < 8) {
        badFactors.push({
            severity: "MODERATE",
            factor: `Het wordt koud vandaag (max ${weather.dayTemperature}°C). Zorg dat je auto goed droogt en gebruik lauwwarm water.`,
        });
    } else if (weather.dayTemperature >= 12 && weather.dayTemperature <= 22) {
        goodFactors.push(
            `Perfecte dagtemperatuur (${weather.dayTemperature}°C) voor wassen`
        );
    } else if (weather.dayTemperature > 25) {
        warnings.push(
            `Het wordt warm vandaag (${weather.dayTemperature}°C). Was in de schaduw en spoel regelmatig af zodat zeep niet opdroogt`
        );
    }

    // Wind analysis
    if (weather.windSpeed > 50) {
        badFactors.push({
            severity: "CRITICAL",
            factor: `Er staat heel harde wind (${weather.windSpeed} km/h). Stof en vuil waait direct terug op je auto.`,
        });
    } else if (weather.windSpeed > 30) {
        badFactors.push({
            severity: "MODERATE",
            factor: `Er staat flinke wind (${weather.windSpeed} km/h). Kans op stof en bladeren`,
        });
    } else if (weather.windSpeed <= 15) {
        goodFactors.push("Rustige wind - ideaal om te wassen");
    }

    // UV analysis
    if (weather.uvIndex > 7) {
        badFactors.push({
            severity: "CRITICAL",
            factor: `De zon is veel te fel (UV ${weather.uvIndex}). Je krijgt gegarandeerd watervlekken en kalkstrepen.`,
        });
    } else if (weather.uvIndex >= 5) {
        warnings.push(
            `De zon is vrij fel (UV ${weather.uvIndex}). Spoel vaak af en was bij voorkeur in de schaduw`
        );
    } else if (weather.uvIndex <= 2 && weather.cloudy) {
        goodFactors.push(
            "Bewolkt - geen risico op watervlekken of kalkstrepen"
        );
    }

    // Current weather description
    const desc = weather.description.toLowerCase();
    if (desc.includes("bewolkt") || desc.includes("grijs")) {
        goodFactors.push("Bewolkt weer - ideaal om te wassen");
    } else if (desc.includes("zon") && weather.uvIndex > 5) {
        warnings.push(
            "Het is zonnig. Zorg dat de auto nat blijft tijdens het wassen"
        );
    }

    // FORECAST ANALYSIS
    if (weather.forecast && weather.forecast.length > 0) {
        const tomorrow = weather.forecast[0];
        const dayAfter = weather.forecast[1];

        if (tomorrow && tomorrow.neersl_perc_dag > 60) {
            badFactors.push({
                severity: "CRITICAL",
                factor: "Morgen regent het flink. Je auto wordt toch weer vies, dus zonde van je geld.",
            });
        } else if (tomorrow && tomorrow.neersl_perc_dag > 30) {
            warnings.push("Morgen kan het regenen");
        }

        if (dayAfter && dayAfter.neersl_perc_dag > 50) {
            warnings.push("Overmorgen wordt regen verwacht");
        } else if (dayAfter && dayAfter.neersl_perc_dag > 30) {
            warnings.push("Het kan overmorgen gaan miezeren");
        }

        if (
            tomorrow &&
            tomorrow.neersl_perc_dag > 30 &&
            tomorrow.windkmh > 25
        ) {
            badFactors.push({
                severity: "CRITICAL",
                factor: `Morgen komt er storm (${tomorrow.windkmh} km/h + regen). Je auto wordt modderig.`,
            });
        }

        if (
            tomorrow &&
            dayAfter &&
            tomorrow.neersl_perc_dag <= 20 &&
            dayAfter.neersl_perc_dag <= 20
        ) {
            goodFactors.push(
                "Het blijft de komende dagen droog - je auto blijft langer schoon"
            );
        }
    }

    // Weather warnings
    if (weather.warnings && weather.warnings.length > 0) {
        badFactors.push({
            severity: "CRITICAL",
            factor: `Er is een weerswaarschuwing van kracht. Wacht tot het voorbij is`,
        });
    }

    // DECISION LOGIC
    const criticalBad =
        badFactors.filter((f) => f.severity === "CRITICAL").length > 0;
    const moderateBad = badFactors.filter(
        (f) => f.severity === "MODERATE"
    ).length;
    const goodCount = goodFactors.length;

    let decision,
        baseMessage,
        reasonCategory = null;

    if (criticalBad) {
        decision = "NEE";
        const criticalReasons = badFactors
            .filter((f) => f.severity === "CRITICAL")
            .map((f) => f.factor)
            .join(" Ook ");
        baseMessage = `Het is zonde van je geld om nu te wassen. ${criticalReasons}`;

        const criticalFactor = badFactors
            .find((f) => f.severity === "CRITICAL")
            .factor.toLowerCase();
        if (
            criticalFactor.includes("storm") ||
            (criticalFactor.includes("wind") &&
                criticalFactor.includes("regen"))
        ) {
            reasonCategory = "STORM";
        } else if (
            criticalFactor.includes("regen") ||
            criticalFactor.includes("regent")
        ) {
            reasonCategory = "REGEN";
        } else if (
            criticalFactor.includes("koud") ||
            criticalFactor.includes("onder 5°c")
        ) {
            reasonCategory = "KOUD";
        } else if (
            criticalFactor.includes("warm") ||
            criticalFactor.includes("fel") ||
            criticalFactor.includes("uv")
        ) {
            const now = new Date();
            const month = now.getMonth() + 1;
            if (month >= 4 && month <= 8 && weather.dayTemperature > 20) {
                reasonCategory = "POLLEN";
            } else {
                reasonCategory = "WARM";
            }
        } else if (criticalFactor.includes("waarschuwing")) {
            reasonCategory = "STORM";
        }
    } else if (moderateBad >= 2) {
        decision = "NEE";
        const reasons = badFactors.map((f) => f.factor).join(" En ");
        baseMessage = `Het is niet verstandig om nu te wassen. ${reasons}`;

        const firstFactor = badFactors[0].factor.toLowerCase();
        if (firstFactor.includes("koud")) {
            reasonCategory = "KOUD";
        } else if (firstFactor.includes("wind")) {
            reasonCategory = "STORM";
        }
    } else if (moderateBad >= 1 && goodCount === 0) {
        decision = "NEE";
        baseMessage = `Het is niet het ideale moment. ${badFactors[0].factor}`;

        const factor = badFactors[0].factor.toLowerCase();
        if (factor.includes("koud")) {
            reasonCategory = "KOUD";
        } else if (factor.includes("wind")) {
            reasonCategory = "STORM";
        }
    } else {
        decision = "JA";
        if (goodCount >= 2) {
            baseMessage = `Prima weer om je auto te wassen! 🚗`;
        } else {
            baseMessage = `Het is een goed moment om je auto te wassen`;
        }
    }

    // ADD WARNINGS TO MESSAGE
    let finalMessage = baseMessage;
    if (warnings.length > 0 && decision === "JA") {
        const warningText = warnings.slice(0, 2).join(". ");
        finalMessage += `. Let op: ${warningText}`;
    } else if (warnings.length > 0 && decision === "NEE") {
        if (
            warnings.some(
                (w) => w.includes("morgen") || w.includes("overmorgen")
            )
        ) {
            const futureWarnings = warnings.filter(
                (w) => w.includes("morgen") || w.includes("overmorgen")
            );
            finalMessage += ` ${futureWarnings[0]}`;
        }
    }

    return {
        decision,
        reason: finalMessage,
        reasonCategory: reasonCategory,
        confidence: criticalBad ? "HIGH" : moderateBad >= 1 ? "MEDIUM" : "HIGH",
        randomNumber: Math.floor(Math.random() * 4) + 1,
        analysis: {
            goodFactors,
            badFactors: badFactors.map((f) => f.factor),
            warnings,
        },
    };
}

// Emergency fallback advice when everything fails
function getEmergencyAdvice() {
    return {
        decision: "MAYBE",
        reason: "We kunnen het weer momenteel niet checken. Kijk zelf naar buiten - is het droog en niet te koud of warm? Dan kun je waarschijnlijk wassen.",
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
