"use client";
import { useEffect, useMemo, useState } from "react";
import { centroid } from "@/lib/geo";
import { dayDate } from "@/lib/itinerary";
import type { DayWeather, Trip } from "@/lib/types";

export interface WxState { days: (DayWeather | undefined)[]; mode: "forecast" | "last-year" | "mixed" | "none"; loading: boolean }

export function useWeather(trip: Trip | null): WxState {
  const [cache, setCache] = useState<Record<string, { d: DayWeather; mode: "forecast" | "last-year" }>>({});
  const [loading, setLoading] = useState(false);

  const reqs = useMemo(() => {
    if (!trip) return [];
    return trip.days.map((d, i) => {
      const pts = d.placeIds.map((id) => trip.places[id]).filter(Boolean);
      const c = pts.length ? centroid(pts) : { lat: 0, lng: 0 };
      return { key: `${c.lat.toFixed(1)},${c.lng.toFixed(1)},${dayDate(trip, i)}`, lat: c.lat, lng: c.lng, date: dayDate(trip, i) };
    });
  }, [trip]);

  useEffect(() => {
    let alive = true;
    const missing = reqs.filter((r) => r.lat !== 0 && !cache[r.key]);
    if (!missing.length) return;
    setLoading(true);
    Promise.all(missing.map(async (r) => {
      try {
        const res = await fetch(`/api/weather?lat=${r.lat}&lng=${r.lng}&date=${r.date}`);
        if (!res.ok) return null;
        const j = await res.json();
        return { key: r.key, d: j.days[0] as DayWeather, mode: j.mode as "forecast" | "last-year" };
      } catch { return null; }
    })).then((rows) => {
      if (!alive) return;
      setCache((c) => { const n = { ...c }; rows.forEach((x) => { if (x) n[x.key] = { d: x.d, mode: x.mode }; }); return n; });
      setLoading(false);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqs]);

  const days = reqs.map((r) => cache[r.key]?.d);
  const modes = new Set(reqs.map((r) => cache[r.key]?.mode).filter(Boolean));
  const mode = modes.size === 0 ? "none" : modes.size > 1 ? "mixed" : ([...modes][0] as "forecast" | "last-year");
  return { days, mode, loading };
}
