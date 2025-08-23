// app/api/daily-update/route.ts

export async function GET() {
    try {
        const currentTime = new Date().toLocaleString("nl-NL", {
            timeZone: "Europe/Amsterdam",
        });

        console.log(`Daily update running at: ${currentTime}`);

        // Step 1: Get weather data
        console.log("Fetching weather data...");
        const weatherData = await getWeatherData();

        // Step 2: Get air quality data
        console.log("Fetching air quality data...");
        const airQualityData = await getAirQualityData();

        // Step 3: Make washing decision based on both
        console.log("Making washing decision...");
        const washingAdvice = makeWashingDecision(weatherData, airQualityData);

        console.log("Final decision:", washingAdvice);

        return Response.json({
            success: true,
            message: "Daily update completed",
            time: currentTime,
            weather: weatherData,
            airQuality: airQualityData,
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

// API Call 1: Weather Data
async function getWeatherData() {
    // For now, mock data - later we'll use real KNMI API
    return {
        temperature: 18,
        uvIndex: 4,
        windSpeed: 25, // km/h
        rainExpected: false,
        cloudy: true,
    };
}

// API Call 2: Air Quality Data
async function getAirQualityData() {
    // For now, mock data - later we'll use real RIVM API
    return {
        saharadustWarning: false,
        pollenLevel: "LOW", // LOW, MEDIUM, HIGH
        airPollution: 35, // PM2.5 value
        ozoneLevel: 45, // ppb
    };
}

// Decision Logic: Combine both data sources
function makeWashingDecision(weather, airQuality) {
    const warnings = [];

    // ❌ CRITICAL FACTORS - Immediate NO

    // Sahara dust is the biggest risk
    if (airQuality.saharadustWarning) {
        return {
            decision: "NO",
            reason: "Saharastof verwacht - je auto wordt binnen uren weer geel/bruin",
            confidence: "HIGH",
            warnings: ["⚠️ Saharastof waarschuwing actief"],
        };
    }

    // High UV causes water spots
    if (weather.uvIndex > 6) {
        return {
            decision: "NO",
            reason: "Felle zon zorgt voor watervlekken - wacht op bewolkt weer",
            confidence: "HIGH",
            warnings: ["☀️ UV-index te hoog"],
        };
    }

    // Too cold for washing products
    if (weather.temperature < 5) {
        return {
            decision: "NO",
            reason: "Te koud - wasproducten werken niet goed onder 5°C",
            confidence: "HIGH",
            warnings: ["🥶 Temperatuur te laag"],
        };
    }

    // High pollen makes car yellow again
    if (airQuality.pollenLevel === "HIGH") {
        return {
            decision: "NO",
            reason: "Stuifmeelpiek - je auto wordt binnen uren weer geel",
            confidence: "HIGH",
            warnings: ["🌼 Hoge pollenconcentratie"],
        };
    }

    // Strong wind blows dust back
    if (weather.windSpeed > 50) {
        return {
            decision: "NO",
            reason: "Harde wind waait stof direct terug op je auto",
            confidence: "HIGH",
            warnings: ["💨 Te veel wind"],
        };
    }

    // ✅ OPTIMAL CONDITIONS
    if (
        weather.cloudy &&
        weather.temperature >= 15 &&
        weather.temperature <= 25 &&
        airQuality.pollenLevel === "LOW"
    ) {
        return {
            decision: "YES",
            reason: "Perfecte omstandigheden - bewolkt, goede temperatuur, weinig pollen",
            confidence: "HIGH",
            warnings: [],
        };
    }

    // ⚠️ MAYBE - Not perfect but acceptable
    if (weather.rainExpected) {
        warnings.push("🌧️ Regen verwacht");
    }

    return {
        decision: "MAYBE",
        reason: "Redelijke omstandigheden - overweeg een snelle spoeling",
        confidence: "MEDIUM",
        warnings,
    };
}
