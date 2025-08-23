// lib/weatherServices.js

// Weerlive.nl API - Dutch weather service
export async function getWeatherData(location = "Amsterdam") {
    try {
        const API_KEY = process.env.WEERLIVE_API_KEY;

        if (!API_KEY) {
            console.log("No Weerlive API key found, using mock data");
            return getMockWeatherData();
        }

        const response = await fetch(
            `https://weerlive.nl/api/weerlive_api_v2.php?key=${API_KEY}&locatie=${encodeURIComponent(
                location
            )}`
        );

        if (!response.ok) {
            throw new Error(`Weerlive API failed: ${response.status}`);
        }

        const data = await response.json();

        if (!data.liveweer || data.liveweer.length === 0) {
            throw new Error("No weather data received from Weerlive");
        }

        const weather = data.liveweer[0];
        const forecast = data.wk_verw || [];

        console.log("Raw Weerlive data:", {
            current: weather.samenv,
            temp: weather.temp,
            wind: weather.windkmh,
            humidity: weather.lv,
        });

        // Calculate UV index from solar radiation (gr = global radiation W/m²)
        // Rough conversion: UV Index ≈ Global Radiation / 25
        const uvIndex = Math.min(Math.round((weather.gr || 0) / 25), 11);

        // Check if rain is expected in forecast
        const rainExpected = forecast.some((day) => day.neersl_perc_dag > 30);

        // Determine if it's cloudy based on description and sun percentage
        const description = weather.samenv.toLowerCase();
        const todayForecast = forecast[0];
        const sunPercentage = todayForecast ? todayForecast.zond_perc_dag : 50;

        const cloudy =
            description.includes("bewolkt") ||
            description.includes("wolken") ||
            sunPercentage < 60;

        return {
            temperature: Math.round(parseFloat(weather.temp)), // Current temp (for reference)
            dayTemperature: forecast[0]
                ? forecast[0].max_temp
                : Math.round(parseFloat(weather.temp)), // Day max temp
            nightTemperature: forecast[0]
                ? forecast[0].min_temp
                : Math.round(parseFloat(weather.temp)), // Day min temp
            uvIndex: uvIndex,
            windSpeed: Math.round(parseFloat(weather.windkmh)),
            rainExpected: rainExpected,
            cloudy: cloudy,
            humidity: parseInt(weather.lv),
            description: weather.samenv,
            warnings: weather.alarm > 0 ? [weather.lkop] : [],
            // Additional useful data
            windDirection: weather.windr,
            pressure: weather.luchtd,
            forecast: forecast.slice(0, 3),
        };
    } catch (error) {
        console.error("Error fetching Weerlive weather data:", error);
    }
}
