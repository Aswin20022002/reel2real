import type { DayWeather } from "./types";

export function wxLabel(code: number): { label: string; emoji: string; wet: boolean } {
  if (code === 0) return { label: "Clear", emoji: "☀️", wet: false };
  if (code <= 2) return { label: "Partly cloudy", emoji: "🌤️", wet: false };
  if (code === 3) return { label: "Overcast", emoji: "☁️", wet: false };
  if (code === 45 || code === 48) return { label: "Fog", emoji: "🌫️", wet: false };
  if (code >= 51 && code <= 57) return { label: "Drizzle", emoji: "🌦️", wet: true };
  if (code >= 61 && code <= 67) return { label: "Rain", emoji: "🌧️", wet: true };
  if (code >= 71 && code <= 77) return { label: "Snow", emoji: "❄️", wet: true };
  if (code >= 80 && code <= 82) return { label: "Showers", emoji: "🌧️", wet: true };
  if (code === 85 || code === 86) return { label: "Snow showers", emoji: "🌨️", wet: true };
  if (code >= 95) return { label: "Thunderstorm", emoji: "⛈️", wet: true };
  return { label: "Mixed", emoji: "🌥️", wet: false };
}

export const isWet = (d: DayWeather) => d.rainMm >= 2 || (d.rainProb ?? 0) >= 50 || wxLabel(d.code).wet;
