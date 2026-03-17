// ---------------------------------------------------------------------------
// Weather API service (OpenWeatherMap)
// ---------------------------------------------------------------------------

import { proxyFetch } from "./proxyFetch";

export interface WeatherResult {
  temp: number;
  description: string;
  icon: string;
  feelsLike: number;
}

const EMPTY_WEATHER: WeatherResult = {
  temp: 0,
  description: "",
  icon: "",
  feelsLike: 0,
};

/**
 * Fetch current weather.
 * Tries: Supabase proxy → direct OpenWeatherMap → mock fallback.
 * Never throws.
 */
export async function getWeather(city = "Seoul"): Promise<WeatherResult> {
  let apiKey = "";
  try {
    apiKey = localStorage.getItem("sophia-api-weather") || "";
  } catch {
    // localStorage unavailable
  }

  // 1. Try Supabase proxy
  try {
    const proxyResult = await proxyFetch<{
      main?: { temp?: number; feels_like?: number };
      weather?: Array<{ description?: string; icon?: string }>;
    }>("weather", { city, apiKey });

    if (proxyResult && proxyResult.main) {
      return {
        temp: Math.round(proxyResult.main.temp ?? 0),
        description: proxyResult.weather?.[0]?.description ?? "",
        icon: proxyResult.weather?.[0]?.icon ?? "",
        feelsLike: Math.round(proxyResult.main.feels_like ?? 0),
      };
    }
  } catch (e) {
    console.warn("[getWeather] proxy failed:", e);
  }

  // 2. Try direct OpenWeatherMap (requires API key)
  if (apiKey) {
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=kr`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        return {
          temp: Math.round(data.main.temp),
          description: data.weather?.[0]?.description ?? "",
          icon: data.weather?.[0]?.icon ?? "",
          feelsLike: Math.round(data.main.feels_like),
        };
      }
      console.warn("Weather API error:", res.status);
    } catch (e) {
      console.warn("Weather fetch failed:", e);
    }
  }

  // 3. Mock fallback (empty data signals no real data available)
  return EMPTY_WEATHER;
}
