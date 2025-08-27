// lib/weatherServices.js - Simpele weather service zonder UV

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
            maxTemp: forecast[0]?.max_temp,
            wind: weather.windkmh,
        });

        // Check if rain is expected in forecast
        const rainExpected = forecast.some((day) => day.neersl_perc_dag > 30);

        // Determine if it's cloudy based on description
        const description = weather.samenv.toLowerCase();
        const cloudy =
            description.includes("bewolkt") || description.includes("wolken");

        return {
            temperature: Math.round(parseFloat(weather.temp)),
            dayTemperature: forecast[0]
                ? forecast[0].max_temp
                : Math.round(parseFloat(weather.temp)),
            nightTemperature: forecast[0]
                ? forecast[0].min_temp
                : Math.round(parseFloat(weather.temp)),
            windSpeed: Math.round(parseFloat(weather.windkmh)),
            rainExpected: rainExpected,
            cloudy: cloudy,
            humidity: parseInt(weather.lv),
            description: weather.samenv,
            warnings: weather.alarm > 0 ? [weather.lkop] : [],
            windDirection: weather.windr,
            pressure: weather.luchtd,
            forecast: forecast.slice(0, 3),
        };
    } catch (error) {
        console.error("Error fetching Weerlive weather data:", error);
    }
}
