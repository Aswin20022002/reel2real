"use client";
import { Backpack, CircleSlash, Droplets, Thermometer, Wind } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { dayDate, fmtDate } from "@/lib/itinerary";
import { buildPacking } from "@/lib/packing";
import type { Trip } from "@/lib/types";
import { isWet, wxLabel } from "@/lib/weather";
import type { WxState } from "./useWeather";

export default function WeatherTab({ trip, wx, meId }: { trip: Trip; wx: WxState; meId: string }) {
  const plan = useMemo(() => buildPacking(trip, wx.days), [trip, wx.days]);
  const key = `r2r:pack:${trip.id}:${meId}`;
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => { try { setDone(JSON.parse(localStorage.getItem(key) || "{}")); } catch { setDone({}); } }, [key]);
  const tick = (id: string) => setDone((d) => { const n = { ...d, [id]: !d[id] }; try { localStorage.setItem(key, JSON.stringify(n)); } catch { /* ignore */ } return n; });
  const total = plan.groups.reduce((s, g) => s + g.items.length, 0);
  const packed = plan.groups.reduce((s, g) => s + g.items.filter((i) => done[i.id]).length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Weather and packing</h2>
        <p className="text-sm text-ink-500">
          {wx.mode === "forecast" ? "Live forecast for each day's area." : wx.mode === "last-year" ? "Your trip is beyond the 16-day forecast window, so this shows typical conditions using the same dates last year. It updates to a live forecast as the trip gets closer." : wx.mode === "mixed" ? "Days inside the 16-day window use the live forecast; later days show last year's conditions." : wx.loading ? "Loading weather..." : "Weather isn't available right now."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {trip.days.map((d, i) => {
          const w = wx.days[i];
          const label = w ? wxLabel(w.code) : null;
          return (
            <div key={d.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div><div className="font-semibold">{d.title}</div><div className="text-xs text-ink-500">{fmtDate(dayDate(trip, i))}</div></div>
                <div className="text-3xl" aria-hidden>{label?.emoji ?? "…"}</div>
              </div>
              {w ? (
                <>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span className="flex items-center gap-1"><Thermometer size={14} className="text-ink-500" />{Math.round(w.tmin)}-{Math.round(w.tmax)}°C</span>
                    <span className="flex items-center gap-1"><Droplets size={14} className={isWet(w) ? "text-sky" : "text-ink-500"} />{w.rainMm.toFixed(0)} mm{w.rainProb !== undefined ? ` · ${w.rainProb}%` : ""}</span>
                    {w.wind !== undefined && <span className="flex items-center gap-1"><Wind size={14} className="text-ink-500" />{Math.round(w.wind)} km/h</span>}
                  </div>
                  <p className="mt-2 text-sm font-semibold">{label?.label}</p>
                </>
              ) : <p className="mt-2 text-sm text-ink-500">{wx.loading ? "Loading..." : "No data"}</p>}
              <p className="mt-2 rounded-lg bg-ink-50 p-2 text-sm text-ink-700"><span className="font-semibold">Wear: </span>{plan.perDay[i]?.outfit}</p>
            </div>
          );
        })}
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2"><Backpack size={18} /><h3 className="font-display text-lg font-bold">Your packing list</h3></div>
          <span className="chip bg-lagoon-50 text-lagoon-700">{packed} of {total} packed</span>
        </div>
        <p className="mt-1 text-sm text-ink-700">{plan.summary} {plan.bag}</p>
        <div className="mt-4 grid gap-6 md:grid-cols-3">
          {plan.groups.map((g) => (
            <div key={g.title}>
              <h4 className="mb-1.5 text-sm font-bold">{g.title}</h4>
              <ul className="space-y-1.5">
                {g.items.map((it) => (
                  <li key={it.id}>
                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-1" checked={!!done[it.id]} onChange={() => tick(it.id)} />
                      <span className={done[it.id] ? "text-ink-300 line-through" : ""}><b>{it.qty ? `${it.qty} × ` : ""}{it.name}</b>{it.why ? <span className="block text-xs text-ink-500">{it.why}</span> : null}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="card border-l-4 border-l-signal p-4">
        <div className="flex items-center gap-2"><CircleSlash size={18} className="text-signal" /><h3 className="font-display text-lg font-bold">Leave these at home</h3></div>
        <ul className="mt-2 space-y-1 text-sm">{plan.skip.map((s) => <li key={s.name}><b>{s.name}</b> <span className="text-ink-500">· {s.why}</span></li>)}</ul>
      </div>
    </div>
  );
}
