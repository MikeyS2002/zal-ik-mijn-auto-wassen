// app/api/daily-update/route.js
import { getWeatherData } from "../../../lib/weatherServices.js";
import { kv } from "@vercel/kv";

export async function GET() {
    try {
        const currentTime = new Date().toLocaleString("nl-NL", {
            timeZone: "Europe/Amsterdam",
        });

        const weatherData = await getWeatherData("Amsterdam");
        const washingAdvice = makeWashingDecision(weatherData);

        // Persist to KV
        const payload = {
            date: new Date().toISOString(),
            advice: washingAdvice,
            weather: weatherData,
        };
        const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

        // Store per-day and a handy "latest" pointer. TTL ~30 hours.
        await kv.set(`advice:${dateKey}`, payload, { ex: 60 * 60 * 30 });
        await kv.set("advice:latest", payload, { ex: 60 * 60 * 30 });

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
            { success: false, error: "Update failed" },
            { status: 500 }
        );
    }
}

// Decision Logic: JA/NEE with smart contextual messages
function makeWashingDecision(weather) {
    const goodFactors = [];
    const badFactors = [];
    const warnings = [];

    console.log("Weather analysis:", {
        currentTemp: weather.temperature,
        dayTemp: weather.dayTemperature,
        nightTemp: weather.nightTemperature,
        description: weather.description,
        wind: weather.windSpeed,
        uv: weather.uvIndex,
        rain: weather.rainExpected,
        forecast: weather.forecast?.slice(0, 2),
    });

    // ANALYZE ALL FACTORS

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

    // FORECAST ANALYSIS - Can override current conditions
    if (weather.forecast && weather.forecast.length > 0) {
        const tomorrow = weather.forecast[0];
        const dayAfter = weather.forecast[1];

        // Heavy rain tomorrow
        if (tomorrow && tomorrow.neersl_perc_dag > 60) {
            badFactors.push({
                severity: "CRITICAL",
                factor: "Morgen regent het flink. Je auto wordt toch weer vies, dus zonde van je geld.",
            });
        } else if (tomorrow && tomorrow.neersl_perc_dag > 30) {
            warnings.push("Morgen kan het regenen");
        }

        // Day after tomorrow rain
        if (dayAfter && dayAfter.neersl_perc_dag > 50) {
            warnings.push("Overmorgen wordt regen verwacht");
        } else if (dayAfter && dayAfter.neersl_perc_dag > 30) {
            warnings.push("Het kan overmorgen gaan miezeren");
        }

        // Storm conditions (wind + rain)
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

        // Good forecast bonus
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

    // Weather warnings from KNMI
    if (weather.warnings && weather.warnings.length > 0) {
        badFactors.push({
            severity: "CRITICAL",
            factor: `Er is een weerswaarschuwing van kracht. Wacht tot het voorbij is`,
        });
    }

    // DECISION LOGIC: JA or NEE
    const criticalBad =
        badFactors.filter((f) => f.severity === "CRITICAL").length > 0;
    const moderateBad = badFactors.filter(
        (f) => f.severity === "MODERATE"
    ).length;
    const goodCount = goodFactors.length;

    let decision,
        baseMessage,
        reasonCategory = null;

    // NEE - Critical bad factors always win
    if (criticalBad) {
        decision = "NEE";
        const criticalReasons = badFactors
            .filter((f) => f.severity === "CRITICAL")
            .map((f) => f.factor)
            .join(" Ook ");
        baseMessage = `Het is zonde van je geld om nu te wassen. ${criticalReasons}`;

        // Determine reason category for image
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
            // Check if it's pollen season (April-August) + warm weather
            const now = new Date();
            const month = now.getMonth() + 1; // 1-12
            if (month >= 4 && month <= 8 && weather.dayTemperature > 20) {
                reasonCategory = "POLLEN";
            } else {
                reasonCategory = "WARM";
            }
        } else if (criticalFactor.includes("waarschuwing")) {
            reasonCategory = "STORM"; // Weather warnings usually mean storm
        }
    }
    // NEE - Too many moderate bad factors
    else if (moderateBad >= 2) {
        decision = "NEE";
        const reasons = badFactors.map((f) => f.factor).join(" En ");
        baseMessage = `Het is niet verstandig om nu te wassen. ${reasons}`;

        // For multiple moderate factors, pick the most severe one
        const firstFactor = badFactors[0].factor.toLowerCase();
        if (firstFactor.includes("wind") && firstFactor.includes("koud")) {
            reasonCategory = "KOUD"; // Cold is usually more critical than wind
        } else if (firstFactor.includes("koud")) {
            reasonCategory = "KOUD";
        } else if (firstFactor.includes("wind")) {
            reasonCategory = "STORM";
        } else if (firstFactor.includes("warm")) {
            const now = new Date();
            const month = now.getMonth() + 1;
            reasonCategory =
                month >= 4 && month <= 8 && weather.dayTemperature > 20
                    ? "POLLEN"
                    : "WARM";
        }
    }
    // NEE - Some bad factors and no good factors
    else if (moderateBad >= 1 && goodCount === 0) {
        decision = "NEE";
        baseMessage = `Het is niet het ideale moment. ${badFactors[0].factor}`;

        const factor = badFactors[0].factor.toLowerCase();
        if (factor.includes("koud")) {
            reasonCategory = "KOUD";
        } else if (factor.includes("wind")) {
            reasonCategory = "STORM";
        } else if (factor.includes("warm")) {
            const now = new Date();
            const month = now.getMonth() + 1;
            reasonCategory =
                month >= 4 && month <= 8 && weather.dayTemperature > 20
                    ? "POLLEN"
                    : "WARM";
        }
    }
    // JA - Everything else
    else {
        decision = "JA";
        if (goodCount >= 2) {
            baseMessage = `Prima weer om je auto te wassen! 🚗`;
        } else {
            baseMessage = `Het is een goed moment om je auto te wassen`;
        }
        reasonCategory = null; // No image needed for JA
    }

    // ADD WARNINGS TO MESSAGE
    let finalMessage = baseMessage;
    if (warnings.length > 0 && decision === "JA") {
        const warningText = warnings.slice(0, 2).join(". "); // Max 2 warnings
        finalMessage += `. Let op: ${warningText}`;
    } else if (warnings.length > 0 && decision === "NEE") {
        // For NEE decisions, warnings are less relevant but can be mentioned
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
        reasonCategory: reasonCategory, // STORM, REGEN, POLLEN, WARM, KOUD, or null
        confidence: criticalBad ? "HIGH" : moderateBad >= 1 ? "MEDIUM" : "HIGH",
        randomNumber: Math.floor(Math.random() * 4) + 1, // Random number 1-4
        analysis: {
            goodFactors,
            badFactors: badFactors.map((f) => f.factor),
            warnings,
        },
    };
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
        console.log("Daily advice stored successfully");
    } catch (error) {
        console.error("Error storing daily advice:", error);
    }
}
