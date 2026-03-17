// ---------------------------------------------------------------------------
// Weather API service (OpenWeatherMap)
// ---------------------------------------------------------------------------

export interface WeatherResult {
  temp: number;
  description: string;
  icon: string;
  feelsLike: number;
}

/**
 * Fetch current weather from OpenWeatherMap.
 * API key is read from localStorage "sophia-api-weather".
 * Falls back to a mock result when no key is configured.
 */
export async function getWeather(city = "Seoul"): Promise<WeatherResult> {
  let apiKey = "";
  try {
    apiKey = localStorage.getItem("sophia-api-weather") || "";
  } catch {
    // localStorage unavailable
  }

  if (!apiKey) {
    // Return null-ish mock so caller knows there is no real data
    return {
      temp: 0,
      description: "",
      icon: "",
      feelsLike: 0,
    };
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=kr`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("Weather API error:", res.status);
      return { temp: 0, description: "", icon: "", feelsLike: 0 };
    }
    const data = await res.json();
    return {
      temp: Math.round(data.main.temp),
      description: data.weather?.[0]?.description ?? "",
      icon: data.weather?.[0]?.icon ?? "",
      feelsLike: Math.round(data.main.feels_like),
    };
  } catch (e) {
    console.warn("Weather fetch failed:", e);
    return { temp: 0, description: "", icon: "", feelsLike: 0 };
  }
}
