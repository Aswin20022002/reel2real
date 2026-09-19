import { CatalogPlace, DESTINATIONS, allCatalogPlaces, getDestination } from "./catalog";
import { LL, buildDayPlan, centroid, driveMin, haversineKm, optimizeOrder, pathKm, roadKm, scheduleDay, ScheduleItem } from "./geo";
import type { Action, Analysis, Day, Member, Pace, Place, Trip } from "./types";

export const uid = (prefix = "id") => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
export const COLORS = ["#0A6CFF", "#E5322D", "#0E9F8E", "#F5A524", "#7C3AED", "#DB2777", "#0891B2", "#65A30D"];
export const shortCode = () => Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");

export function newMember(name: string, index: number, upi?: string): Member {
  return { id: uid("m"), name: name.trim() || `Traveller ${index + 1}`, color: COLORS[index % COLORS.length], upi, updatedAt: Date.now() };
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", opts);
}
export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export const stops = (trip: Trip): Place[] => Object.values(trip.places).filter((p) => p.category !== "stay");
export const hillsOf = (trip: Trip) => getDestination(trip.destinationKey)?.hills ?? true;
export const dayDate = (trip: Trip, i: number) => addDays(trip.startDate, i);

export function startPoint(trip: Trip): LL {
  const d = getDestination(trip.destinationKey);
  if (d) return d.gateway;
  const s = stops(trip);
  return s.length ? centroid(s) : { lat: 20.5937, lng: 78.9629 };
}

export function dayStart(trip: Trip, di: number): LL {
  if (di <= 0) return startPoint(trip);
  const prev = trip.days[di - 1];
  const stay = prev?.stayId ? trip.places[prev.stayId] : undefined;
  if (stay) return stay;
  const last = prev?.placeIds.map((id) => trip.places[id]).filter(Boolean).pop();
  return last ?? startPoint(trip);
}

export function daySchedule(trip: Trip, di: number): ScheduleItem[] {
  const day = trip.days[di];
  if (!day) return [];
  return scheduleDay(day.placeIds, trip.places, day.startTime, dayStart(trip, di), hillsOf(trip));
}

export function dayKm(trip: Trip, di: number): number {
  const day = trip.days[di];
  if (!day) return 0;
  const pts: LL[] = [dayStart(trip, di), ...day.placeIds.map((id) => trip.places[id]).filter(Boolean)];
  return pathKm(pts);
}

function mostCommon(arr: string[]): string {
  const m = new Map<string, number>();
  arr.forEach((a) => m.set(a, (m.get(a) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

function nearestStay(trip: Trip, pts: LL[]): Place | undefined {
  const d = getDestination(trip.destinationKey);
  if (!d || !pts.length) return undefined;
  const c = centroid(pts);
  return [...d.stays].sort((a, b) => haversineKm(c, a) - haversineKm(c, b))[0];
}

/** Recompute day titles, drop empty days and attach a suggested stay if none is set. */
export function refreshMeta(trip: Trip, keepStays = true): Trip {
  const days = trip.days.filter((d) => d.placeIds.length > 0 || trip.days.length === 1);
  const places = { ...trip.places };
  const out: Day[] = days.map((d, i) => {
    const pl = d.placeIds.map((id) => places[id]).filter(Boolean);
    const area = mostCommon(pl.map((p) => p.area));
    let stayId = keepStays ? d.stayId : undefined;
    if (!stayId || !places[stayId]) {
      const s = nearestStay(trip, pl);
      if (s) { places[s.id] = s; stayId = s.id; }
    }
    return { ...d, title: area ? `Day ${i + 1}: ${area}` : `Day ${i + 1}`, stayId };
  });
  // remove stays that no day references
  const used = new Set(out.map((d) => d.stayId).filter(Boolean) as string[]);
  for (const id of Object.keys(places)) if (places[id].category === "stay" && !used.has(id)) delete places[id];
  return { ...trip, days: out, places };
}

function touch(t: Trip): Trip {
  const now = Date.now();
  return { ...t, updatedAt: now, itinUpdatedAt: now };
}

export function buildTripFromAnalysis(
  a: Analysis,
  opts: { names: string[]; origin: string; startDate: string; pace: Pace; upi?: Record<string, string> }
): Trip {
  const now = Date.now();
  const dest = getDestination(a.destinationKey);
  const places: Record<string, Place> = {};
  a.places.forEach((p) => (places[p.id] = p));
  const members = opts.names.map((n, i) => newMember(n, i));
  const base: Trip = {
    id: shortCode(), name: a.title || `${a.destination} trip`, destinationKey: a.destinationKey, destination: a.destination,
    origin: opts.origin, startDate: opts.startDate, pace: opts.pace, days: [], places, members, expenses: [], settlements: [], bookings: [],
    budgetINR: 0, reel: a.reel, createdAt: now, updatedAt: now, itinUpdatedAt: now,
  };
  const start = startPoint(base);
  const plan = buildDayPlan(a.places.filter((p) => p.category !== "stay"), opts.pace, start, dest?.hills ?? true, a.suggestedDays);
  base.days = plan.map((ids, i) => ({ id: uid("d"), title: `Day ${i + 1}`, placeIds: ids, startTime: "09:00" }));
  const t = refreshMeta(base, false);
  t.budgetINR = Math.round((estimate(t).groupTotal * 1.15) / 500) * 500;
  return t;
}

export function rebuildAll(trip: Trip, pace: Pace): Trip {
  const s = stops(trip);
  const plan = buildDayPlan(s, pace, startPoint(trip), hillsOf(trip));
  const t: Trip = { ...trip, pace, days: plan.map((ids, i) => ({ id: uid("d"), title: `Day ${i + 1}`, placeIds: ids, startTime: trip.days[i]?.startTime ?? "09:00" })) };
  return touch(refreshMeta(t, false));
}

export function addPlaceToTrip(trip: Trip, rawPlace: Place, dayIndex?: number): Trip {
  const place = { ...rawPlace } as Place & { aliases?: unknown; iconic?: unknown };
  delete place.aliases; delete place.iconic;
  if (trip.places[place.id]) return trip;
  const places = { ...trip.places, [place.id]: place };
  let days = trip.days.map((d) => ({ ...d, placeIds: [...d.placeIds] }));
  if (!days.length) days = [{ id: uid("d"), title: "Day 1", placeIds: [], startTime: "09:00" }];
  let di = dayIndex ?? -1;
  if (di < 0 || di >= days.length) {
    let bd = Infinity;
    days.forEach((d, i) => {
      const pts = d.placeIds.map((id) => places[id]).filter(Boolean);
      const dist = pts.length ? haversineKm(centroid(pts), place) : 9999;
      if (dist < bd) { bd = dist; di = i; }
    });
    if (di < 0) di = 0;
  }
  // cheapest insertion
  const ids = days[di].placeIds;
  const from = dayStart({ ...trip, places, days }, di);
  let bestPos = ids.length, bestCost = Infinity;
  for (let pos = 0; pos <= ids.length; pos++) {
    const seq = [...ids.slice(0, pos), place.id, ...ids.slice(pos)].map((id) => places[id]);
    const cost = pathKm([from, ...seq]);
    if (cost < bestCost) { bestCost = cost; bestPos = pos; }
  }
  ids.splice(bestPos, 0, place.id);
  return touch(refreshMeta({ ...trip, places, days }));
}

export function removePlace(trip: Trip, id: string): Trip {
  const places = { ...trip.places };
  delete places[id];
  const days = trip.days.map((d) => ({ ...d, placeIds: d.placeIds.filter((p) => p !== id) }));
  return touch(refreshMeta({ ...trip, places, days }));
}

export function movePlace(trip: Trip, id: string, dayIndex: number): Trip {
  if (dayIndex < 0) return trip;
  let days = trip.days.map((d) => ({ ...d, placeIds: d.placeIds.filter((p) => p !== id) }));
  if (dayIndex >= days.length) days = [...days, { id: uid("d"), title: `Day ${days.length + 1}`, placeIds: [], startTime: "09:00" }];
  days[dayIndex] = { ...days[dayIndex], placeIds: [...days[dayIndex].placeIds, id] };
  const t = { ...trip, days };
  const from = dayStart(t, dayIndex);
  const pts = days[dayIndex].placeIds.map((pid) => trip.places[pid]);
  const order = optimizeOrder(pts, from);
  days[dayIndex] = { ...days[dayIndex], placeIds: order.map((i) => days[dayIndex].placeIds[i]) };
  return touch(refreshMeta({ ...trip, days }));
}

export function shiftPlace(trip: Trip, di: number, from: number, to: number): Trip {
  const days = trip.days.map((d) => ({ ...d, placeIds: [...d.placeIds] }));
  const ids = days[di]?.placeIds;
  if (!ids || to < 0 || to >= ids.length) return trip;
  const [x] = ids.splice(from, 1);
  ids.splice(to, 0, x);
  return touch({ ...trip, days });
}

export function optimizeDay(trip: Trip, di: number): { trip: Trip; beforeKm: number; afterKm: number } {
  const day = trip.days[di];
  const beforeKm = dayKm(trip, di);
  if (!day || day.placeIds.length < 2) return { trip, beforeKm, afterKm: beforeKm };
  const from = dayStart(trip, di);
  const pts = day.placeIds.map((id) => trip.places[id]);
  const order = optimizeOrder(pts, from);
  const days = trip.days.map((d, i) => (i === di ? { ...d, placeIds: order.map((k) => day.placeIds[k]) } : d));
  const t = touch({ ...trip, days });
  return { trip: t, beforeKm, afterKm: dayKm(t, di) };
}

export function setDayStart(trip: Trip, di: number, startTime: string): Trip {
  const days = trip.days.map((d, i) => (i === di ? { ...d, startTime } : d));
  return touch({ ...trip, days });
}

export function applyAction(trip: Trip, a: Action): Trip {
  switch (a.type) {
    case "remove": return removePlace(trip, a.placeId);
    case "add": return addPlaceToTrip(trip, a.place, a.dayIndex);
    case "move": return movePlace(trip, a.placeId, a.dayIndex);
    case "setPace": return rebuildAll(trip, a.pace);
    case "swap": {
      const di = trip.days.findIndex((d) => d.placeIds.includes(a.removeId));
      const removed = removePlace(trip, a.removeId);
      return addPlaceToTrip(removed, a.place, di >= 0 ? Math.min(di, removed.days.length - 1) : undefined);
    }
  }
}

// ---------- alternatives / plan B ----------
export type Reason = "closed" | "rain" | "far" | "budget" | "skip";
export interface Alt { place: Place; distanceKm: number; why: string }

function candidatePool(trip: Trip): CatalogPlace[] {
  const dest = getDestination(trip.destinationKey);
  const c = centroid(stops(trip));
  const pool = dest ? dest.places : allCatalogPlaces().filter((p) => p.category !== "stay" && haversineKm(c, p) < 250);
  return pool.filter((p) => !trip.places[p.id]);
}

export function alternativesFor(trip: Trip, place: Place, reason: Reason, limit = 5): Alt[] {
  const month = new Date(trip.startDate + "T00:00:00").getMonth() + 1;
  return candidatePool(trip)
    .filter((p) => !(p.season?.closedMonths ?? []).includes(month))
    .map((p) => {
      const km = roadKm(place, p);
      let score = km;
      const why: string[] = [];
      if (p.category === place.category) { score -= 18; why.push(`same kind of stop (${p.category})`); }
      if (reason === "rain" && p.indoor) { score -= 30; why.push("covered / indoor"); }
      if (reason === "rain" && !p.indoor) score += 15;
      if (reason === "budget") { score += Math.max(0, p.costINR - place.costINR) / 40; if (p.costINR <= place.costINR) why.push(`cheaper (${inr(p.costINR)} vs ${inr(place.costINR)})`); }
      if (reason === "far") score += km * 0.5;
      if (p.iconic) score -= 4;
      if (km < 40) why.push(`only ${Math.round(km)} km away`);
      return { place: p, distanceKm: km, why: why.join(", ") || `${Math.round(km)} km away`, score };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(({ place: pl, distanceKm, why }) => ({ place: pl, distanceKm, why }));
}

const COMPAT: Record<string, string[]> = {
  sight: ["sight", "nature", "adventure", "culture"], nature: ["nature", "sight", "adventure"], adventure: ["adventure", "nature", "sight"],
  culture: ["culture", "sight"], food: ["food"], shopping: ["shopping", "food"], wellness: ["wellness"], stay: ["stay"],
};
export function planBFor(trip: Trip, place: Place): Place | undefined {
  return alternativesFor(trip, place, "closed", 8).find((a) => (COMPAT[place.category] ?? [place.category]).includes(a.place.category))?.place;
}

export function suggestNearby(trip: Trip, limit = 8): Place[] {
  const c = centroid(stops(trip));
  return candidatePool(trip)
    .sort((a, b) => (b.iconic ? 1 : 0) - (a.iconic ? 1 : 0) || haversineKm(c, a) - haversineKm(c, b))
    .slice(0, limit);
}

export function realityAlerts(trip: Trip): { placeId: string; dayIndex: number; note: string }[] {
  const out: { placeId: string; dayIndex: number; note: string }[] = [];
  trip.days.forEach((d, i) => {
    const month = new Date(dayDate(trip, i) + "T00:00:00").getMonth() + 1;
    d.placeIds.forEach((id) => {
      const p = trip.places[id];
      if (p?.season?.closedMonths.includes(month)) out.push({ placeId: id, dayIndex: i, note: p.season.note });
    });
  });
  return out;
}

export interface Estimate {
  activities: number; stay: number; food: number; localTransport: number; total: number; groupTotal: number; km: number; nights: number;
}
/** Indicative per-person costs. Live prices come from MakeMyTrip at booking time. */
export function estimate(trip: Trip): Estimate {
  const n = Math.max(1, trip.members.length);
  const s = stops(trip);
  const activities = s.reduce((t, p) => t + p.costINR, 0);
  const nights = Math.max(0, trip.days.length - 1);
  const rooms = Math.ceil(n / 2);
  let stayTotal = 0;
  for (let i = 0; i < nights; i++) {
    const st = trip.days[i]?.stayId ? trip.places[trip.days[i].stayId as string] : undefined;
    stayTotal += (st?.nightINR ?? 3000) * rooms;
  }
  const km = trip.days.reduce((t, _, i) => t + dayKm(trip, i), 0);
  const cab = km * 14 + trip.days.length * 500;
  const foodPerDay = 700;
  const stay = stayTotal / n;
  const food = foodPerDay * trip.days.length;
  const localTransport = cab / n;
  const total = activities + stay + food + localTransport;
  return { activities, stay, food, localTransport, total, groupTotal: total * n, km, nights };
}

export { DESTINATIONS, driveMin };
