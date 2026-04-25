// ---------------------------------------------------------------------------
// Weather API service (OpenWeatherMap)
// ---------------------------------------------------------------------------

import { proxyFetch } from "./proxyFetch";

export interface WeatherResult {
  temp: number;
  tempMin?: number;
  tempMax?: number;
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
      main?: { temp?: number; temp_min?: number; temp_max?: number; feels_like?: number };
      weather?: Array<{ description?: string; icon?: string }>;
    }>("weather", { city, apiKey });

    if (proxyResult && proxyResult.main) {
      return {
        temp: Math.round(proxyResult.main.temp ?? 0),
        tempMin: proxyResult.main.temp_min != null ? Math.round(proxyResult.main.temp_min) : undefined,
        tempMax: proxyResult.main.temp_max != null ? Math.round(proxyResult.main.temp_max) : undefined,
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
      const [currentRes, forecastRes] = await Promise.allSettled([
        fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=kr`),
        fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=kr&cnt=8`),
      ]);

      if (currentRes.status === "fulfilled" && currentRes.value.ok) {
        const data = await currentRes.value.json();

        // forecast에서 오늘 최저/최고 계산
        let todayMin: number | undefined;
        let todayMax: number | undefined;
        if (forecastRes.status === "fulfilled" && forecastRes.value.ok) {
          const fc = await forecastRes.value.json();
          const today = new Date().toISOString().slice(0, 10);
          const todayTemps = (fc.list || [])
            .filter((item: { dt_txt?: string }) => item.dt_txt?.startsWith(today))
            .map((item: { main?: { temp_min?: number; temp_max?: number } }) => ({
              min: item.main?.temp_min ?? 999,
              max: item.main?.temp_max ?? -999,
            }));
          if (todayTemps.length > 0) {
            todayMin = Math.round(Math.min(...todayTemps.map((t: { min: number }) => t.min)));
            todayMax = Math.round(Math.max(...todayTemps.map((t: { max: number }) => t.max)));
          }
        }

        return {
          temp: Math.round(data.main.temp),
          tempMin: todayMin,
          tempMax: todayMax,
          description: data.weather?.[0]?.description ?? "",
          icon: data.weather?.[0]?.icon ?? "",
          feelsLike: Math.round(data.main.feels_like),
        };
      }
      console.warn("Weather API error: response not ok");
    } catch (e) {
      console.warn("Weather fetch failed:", e);
    }
  }

  // 3. Mock fallback (empty data signals no real data available)
  return EMPTY_WEATHER;
}
