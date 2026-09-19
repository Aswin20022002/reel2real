"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { getDestination } from "@/lib/catalog";
import { dayStart, hillsOf } from "@/lib/itinerary";
import type { Trip } from "@/lib/types";

export const DAY_COLORS = ["#0A6CFF", "#E5322D", "#0E9F8E", "#F5A524", "#7C3AED", "#DB2777", "#0891B2", "#65A30D", "#475569", "#B45309"];

export interface RouteInfo { km: number; min: number }

export default function MapView({ trip, focus, onRoute }: { trip: Trip; focus: number; onRoute?: (dayIndex: number, info: RouteInfo | null) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const layer = useRef<import("leaflet").LayerGroup | null>(null);
  const onRouteRef = useRef(onRoute);
  onRouteRef.current = onRoute;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      if (!map.current) {
        map.current = L.map(el.current, { scrollWheelZoom: false }).setView([22, 79], 5);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap contributors" }).addTo(map.current);
        layer.current = L.layerGroup().addTo(map.current);
      }
      const g = layer.current!;
      g.clearLayers();
      const bounds: [number, number][] = [];
      const gw = getDestination(trip.destinationKey)?.gateway;
      if (gw) {
        L.marker([gw.lat, gw.lng], { icon: L.divIcon({ className: "", html: `<div class="r2r-pin" style="background:#0B1F3A"><span>✈</span></div>`, iconSize: [28, 28], iconAnchor: [14, 28] }) }).bindTooltip(`Arrive: ${gw.name} (${gw.code})`).addTo(g);
        bounds.push([gw.lat, gw.lng]);
      }
      trip.days.forEach((day, di) => {
        if (focus >= 0 && focus !== di) return;
        const color = DAY_COLORS[di % DAY_COLORS.length];
        const pts = day.placeIds.map((id) => trip.places[id]).filter(Boolean);
        const start = dayStart(trip, di);
        const seq: [number, number][] = [[start.lat, start.lng], ...pts.map((p) => [p.lat, p.lng] as [number, number])];
        const straight = L.polyline(seq, { color, weight: 3, opacity: 0.55, dashArray: "6 6" }).addTo(g);
        pts.forEach((p, i) => {
          L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "", html: `<div class="r2r-pin" style="background:${color}"><span>${i + 1}</span></div>`, iconSize: [28, 28], iconAnchor: [14, 28] }) })
            .bindTooltip(`Day ${di + 1}, stop ${i + 1}: ${p.name}`).addTo(g);
          bounds.push([p.lat, p.lng]);
        });
        const stay = day.stayId ? trip.places[day.stayId] : undefined;
        if (stay) L.marker([stay.lat, stay.lng], { icon: L.divIcon({ className: "", html: `<div style="width:22px;height:22px;border-radius:6px;background:#fff;border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-size:12px">🛏</div>`, iconSize: [22, 22], iconAnchor: [11, 11] }) }).bindTooltip(`Night ${di + 1}: ${stay.name}`).addTo(g);
        if (seq.length > 1) {
          fetch(`/api/route?pts=${seq.map(([a, b]) => `${a},${b}`).join(";")}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => {
              if (cancelled || !j?.line) { onRouteRef.current?.(di, null); return; }
              straight.remove();
              L.polyline(j.line, { color, weight: 4, opacity: 0.85 }).addTo(g);
              onRouteRef.current?.(di, { km: j.km, min: j.min });
            }).catch(() => onRouteRef.current?.(di, null));
        }
      });
      void hillsOf;
      if (bounds.length) map.current!.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
      setTimeout(() => map.current?.invalidateSize(), 50);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.itinUpdatedAt, trip.id, focus]);

  useEffect(() => () => { map.current?.remove(); map.current = null; }, []);
  return <div ref={el} className="h-[440px] w-full overflow-hidden rounded-2xl border border-ink-100" role="region" aria-label="Trip map" />;
}
