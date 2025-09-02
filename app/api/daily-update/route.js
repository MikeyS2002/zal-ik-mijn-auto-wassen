// app/api/daily-update/route.js
import { getWeatherData } from "../../../lib/weatherServices.js";
import { createClient } from "redis";

// Function to get Redis client when needed
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

export async function GET() {
    try {
        const currentTime = new Date().toLocaleString("nl-NL", {
            timeZone: "Europe/Amsterdam",
        });

        console.log(`Daily update running at: ${currentTime}`);

        // Get weather data from Weerlive.nl
        console.log("Fetching weather data from Weerlive...");
        const weatherData = await getWeatherData("Amsterdam");

        // Make washing decision based on weather
        console.log("Making washing decision...");
        const washingAdvice = makeWashingDecision(weatherData);

        console.log("Final decision:", washingAdvice);

        // Store the advice in Redis
        await storeAdviceInRedis(washingAdvice, weatherData);

        return Response.json({
            success: true,
            message: "Daily update completed",
            time: currentTime,
            weather: weatherData,
            advice: washingAdvice,
        });
    } catch (error) {
        console.error("Error in daily update:", error);

        return Response.json(
            { success: false, error: "Update failed", details: error.message },
            { status: 500 }
        );
    }
}

// Decision Logic: JA/NEE with smart contextual messages
// Decision Logic volgens PDF specificaties - Alleen Regen & Temperatuur
function makeWashingDecision(weather) {
    console.log("Weather analysis:", {
        currentTemp: weather.temperature,
        dayTemp: weather.dayTemperature,
        nightTemp: weather.nightTemperature,
        description: weather.description,
        rainExpected: weather.rainExpected,
        forecast: weather.forecast?.slice(0, 2),
    });

    // Check voor regen vandaag
    const desc = weather.description.toLowerCase();
    const rainingToday = desc.includes("regen") || desc.includes("bui");

    // Check forecast voor morgen en overmorgen
    const tomorrow =
        weather.forecast && weather.forecast[0] ? weather.forecast[0] : null;
    const dayAfter =
        weather.forecast && weather.forecast[1] ? weather.forecast[1] : null;

    const rainTomorrow = tomorrow && tomorrow.neersl_perc_dag > 60;
    const rainDayAfter = dayAfter && dayAfter.neersl_perc_dag > 60;
    const lightRainTomorrow =
        tomorrow &&
        tomorrow.neersl_perc_dag > 30 &&
        tomorrow.neersl_perc_dag <= 60;
    const lightRainDayAfter =
        dayAfter &&
        dayAfter.neersl_perc_dag > 30 &&
        dayAfter.neersl_perc_dag <= 60;
    const stormTomorrow =
        tomorrow && tomorrow.neersl_perc_dag > 60 && tomorrow.windkmh > 25;
    const stormDayAfter =
        dayAfter && dayAfter.neersl_perc_dag > 60 && dayAfter.windkmh > 25;

    // KNMI waarschuwingen
    const hasWeatherWarning = weather.warnings && weather.warnings.length > 0;

    // REGEN LOGIC volgens PDF
    if (hasWeatherWarning) {
        return {
            decision: "NEE",
            reason: "Er is een weerswaarschuwing van kracht. Wacht tot het voorbij is.",
            reasonCategory: "STORM",
            confidence: "HIGH",
            randomNumber: Math.floor(Math.random() * 4) + 1,
            analysis: {
                goodFactors: [],
                badFactors: ["Weerswaarschuwing"],
                warnings: [],
            },
        };
    }

    // Bepaal of het sneeuwt (onder 0 graden)
    const isSnowing = weather.dayTemperature <= 0;
    const weatherWord = isSnowing ? "sneeuwen" : "regenen";
    const weatherCategory = isSnowing ? "KOUD" : "REGEN";
    const stormCategory = isSnowing ? "KOUD" : "STORM";

    if (rainingToday) {
        return {
            decision: "NEE",
            reason: isSnowing
                ? "Het sneeuwt vandaag."
                : "Het gaat vandaag regenen.",
            reasonCategory: weatherCategory,
            confidence: "HIGH",
            randomNumber: Math.floor(Math.random() * 4) + 1,
            analysis: {
                goodFactors: [],
                badFactors: [isSnowing ? "Sneeuw vandaag" : "Regen vandaag"],
                warnings: [],
            },
        };
    }

    if (rainTomorrow && rainDayAfter) {
        return {
            decision: "NEE",
            reason: `De aankomende dagen gaat het ${weatherWord}.`,
            reasonCategory: stormCategory,
            confidence: "HIGH",
            randomNumber: Math.floor(Math.random() * 4) + 1,
            analysis: {
                goodFactors: [],
                badFactors: [
                    isSnowing
                        ? "Sneeuw morgen en overmorgen"
                        : "Regen morgen en overmorgen",
                ],
                warnings: [],
            },
        };
    }

    if (rainingToday && rainTomorrow && !rainDayAfter) {
        return {
            decision: "NEE",
            reason: `Vandaag en morgen gaat het ${weatherWord}. Je kunt het beste wachten tot overmorgen.`,
            reasonCategory: stormCategory,
            confidence: "HIGH",
            randomNumber: Math.floor(Math.random() * 4) + 1,
            analysis: {
                goodFactors: [],
                badFactors: [
                    isSnowing
                        ? "Sneeuw vandaag en morgen"
                        : "Regen vandaag en morgen",
                ],
                warnings: [],
            },
        };
    }

    if (!rainingToday && rainTomorrow && rainDayAfter) {
        return {
            decision: "NEE",
            reason: `Het gaat morgen en overmorgen ${weatherWord}.`,
            reasonCategory: stormCategory,
            confidence: "HIGH",
            randomNumber: Math.floor(Math.random() * 4) + 1,
            analysis: {
                goodFactors: [],
                badFactors: [
                    isSnowing
                        ? "Sneeuw morgen en overmorgen"
                        : "Regen morgen en overmorgen",
                ],
                warnings: [],
            },
        };
    }

    if (stormTomorrow) {
        return {
            decision: "NEE",
            reason: isSnowing
                ? "Nee morgen is er een sneeuwstorm op komst, het zou zonde zijn om nu je auto te wassen."
                : "Nee morgen is er storm op komst, het zou zonde zijn om nu je auto te wassen.",
            reasonCategory: stormCategory,
            confidence: "HIGH",
            randomNumber: Math.floor(Math.random() * 4) + 1,
            analysis: {
                goodFactors: [],
                badFactors: [isSnowing ? "Sneeuwstorm morgen" : "Storm morgen"],
                warnings: [],
            },
        };
    }

    if (stormDayAfter) {
        return {
            decision: "NEE",
            reason: isSnowing
                ? "Het gaat overmorgen keihard sneeuwen."
                : "Het gaat overmorgen keihard regenen.",
            reasonCategory: stormCategory,
            confidence: "HIGH",
            randomNumber: Math.floor(Math.random() * 4) + 1,
            analysis: {
                goodFactors: [],
                badFactors: [
                    isSnowing ? "Sneeuwstorm overmorgen" : "Storm overmorgen",
                ],
                warnings: [],
            },
        };
    }

    if (rainTomorrow) {
        return {
            decision: "NEE",
            reason: `Het gaat morgen ${weatherWord}.`,
            reasonCategory: weatherCategory,
            confidence: "HIGH",
            randomNumber: Math.floor(Math.random() * 4) + 1,
            analysis: {
                goodFactors: [],
                badFactors: [isSnowing ? "Sneeuw morgen" : "Regen morgen"],
                warnings: [],
            },
        };
    }

    // TEMPERATUUR LOGIC volgens PDF
    if (weather.dayTemperature >= 30) {
        return {
            decision: "NEE",
            reason: "Het is extreem warm, er kunnen watervlekken op je auto komen.",
            reasonCategory: "WARM",
            confidence: "HIGH",
            randomNumber: Math.floor(Math.random() * 4) + 1,
            analysis: {
                goodFactors: [],
                badFactors: ["Extreem warm"],
                warnings: [],
            },
        };
    }

    // Pollenseizoen check (april-augustus)
    const now = new Date();
    const month = now.getMonth() + 1;
    const isPollenSeason = month >= 4 && month <= 8;

    if (weather.dayTemperature > 25 && isPollenSeason) {
        return {
            decision: "NEE",
            reason: "Met deze warmte in het pollenseizoen kan je auto heel snel weer vies worden.",
            reasonCategory: "POLLEN",
            confidence: "HIGH",
            randomNumber: Math.floor(Math.random() * 4) + 1,
            analysis: {
                goodFactors: [],
                badFactors: ["Warm + pollen"],
                warnings: [],
            },
        };
    }

    if (weather.dayTemperature > 25) {
        return {
            decision: "NEE",
            reason: "Je kan je auto wassen. Let op: overmorgen gaat het miezeren.", // Dit lijkt een fout in PDF, maar ik volg het exact
            reasonCategory: "WARM",
            confidence: "MEDIUM",
            randomNumber: Math.floor(Math.random() * 4) + 1,
            analysis: {
                goodFactors: [],
                badFactors: ["Te warm"],
                warnings: ["Warm weer"],
            },
        };
    }

    if (weather.dayTemperature < 0) {
        return {
            decision: "NEE",
            reason: "Het vriest, het is niet handig om je auto nu te wassen.",
            reasonCategory: "KOUD",
            confidence: "HIGH",
            randomNumber: Math.floor(Math.random() * 4) + 1,
            analysis: { goodFactors: [], badFactors: ["Vorst"], warnings: [] },
        };
    }

    if (weather.dayTemperature < 5) {
        return {
            decision: "JA",
            reason: "Maar let op; schoonmaakspullen kunnen minder goed werken.",
            reasonCategory: "KOUD",
            confidence: "MEDIUM",
            randomNumber: Math.floor(Math.random() * 4) + 1,
            analysis: {
                goodFactors: ["Kan wassen"],
                badFactors: [],
                warnings: ["Koud weer"],
            },
        };
    }

    // Tussen 5 en 25 graden - check voor lichte regen/sneeuw overmorgen
    if (lightRainDayAfter) {
        const lightWeatherWord = isSnowing ? "gaan sneeuwen" : "miezeren";
        return {
            decision: "JA",
            reason: `Je kan je auto wassen. Let op: overmorgen gaat het ${lightWeatherWord}.`,
            reasonCategory: null,
            confidence: "MEDIUM",
            randomNumber: Math.floor(Math.random() * 4) + 1,
            analysis: {
                goodFactors: ["Goed weer"],
                badFactors: [],
                warnings: [
                    isSnowing ? "Sneeuw overmorgen" : "Regen overmorgen",
                ],
            },
        };
    }

    // Default tussen 5 en 25 graden
    return {
        decision: "JA",
        reason: "Het is een goed moment om je auto te wassen.",
        reasonCategory: null,
        confidence: "HIGH",
        randomNumber: Math.floor(Math.random() * 4) + 1,
        analysis: {
            goodFactors: ["Perfect weer"],
            badFactors: [],
            warnings: [],
        },
    };
}

// Store advice in Redis database
async function storeAdviceInRedis(advice, weather) {
    let redis = null;

    try {
        redis = await getRedisClient();
        if (!redis) {
            console.log("Redis not available, skipping storage");
            return;
        }

        const adviceData = {
            date: new Date().toISOString(),
            generatedAt: new Date().toLocaleString("nl-NL", {
                timeZone: "Europe/Amsterdam",
            }),
            advice,
            weather,
        };

        await redis.set("daily-advice", JSON.stringify(adviceData));
        console.log("Daily advice stored in Redis successfully");
    } catch (error) {
        console.error("Error storing daily advice in Redis:", error);
    } finally {
        if (redis && redis.isReady) {
            await redis.quit();
        }
    }
}
