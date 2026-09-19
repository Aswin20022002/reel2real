import { NextResponse } from "next/server";
import type { DayWeather } from "@/lib/types";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

// Open-Meteo: free, no API key. Forecast covers ~16 days; beyond that we show the same dates last year as a "typical" guide.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  const date = u.searchParams.get("date") ?? "";
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "bad params" }, { status: 400 });
  const today = iso(new Date());
  const horizon = addDays(today, 15);
  try {
    if (date >= today && date <= horizon) {
      const q = `latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weathercode,windspeed_10m_max,uv_index_max&timezone=auto&start_date=${date}&end_date=${date}`;
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`, { next: { revalidate: 3600 } });
      const j = await r.json();
      const d = j.daily;
      const day: DayWeather = { date, tmax: d.temperature_2m_max[0], tmin: d.temperature_2m_min[0], rainMm: d.precipitation_sum[0] ?? 0, rainProb: d.precipitation_probability_max?.[0] ?? undefined, code: d.weathercode[0] ?? 0, wind: d.windspeed_10m_max?.[0], uv: d.uv_index_max?.[0] };
      return NextResponse.json({ mode: "forecast", days: [day] });
    }
    // typical conditions: same date one year earlier (or the latest complete year before today)
    let past = addDays(date, -365);
    while (past > addDays(today, -7)) past = addDays(past, -365);
    const q = `latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,windspeed_10m_max&timezone=auto&start_date=${past}&end_date=${past}`;
    const r = await fetch(`https://archive-api.open-meteo.com/v1/archive?${q}`, { next: { revalidate: 86400 } });
    const j = await r.json();
    const d = j.daily;
    const day: DayWeather = { date, tmax: d.temperature_2m_max[0], tmin: d.temperature_2m_min[0], rainMm: d.precipitation_sum[0] ?? 0, code: d.weathercode[0] ?? 0, wind: d.windspeed_10m_max?.[0] };
    return NextResponse.json({ mode: "last-year", days: [day] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "weather unavailable" }, { status: 502 });
  }
}
