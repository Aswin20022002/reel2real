import type { Pace, Place } from "./types";

export interface LL { lat: number; lng: number }

export function haversineKm(a: LL, b: LL): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Straight-line distance inflated to approximate road distance. */
export const roadKm = (a: LL, b: LL) => haversineKm(a, b) * 1.35;

/** Estimated drive minutes; hills are slower. */
export function driveMin(km: number, hills = true): number {
  const speed = hills ? 32 : 42;
  return Math.round((km / speed) * 60);
}

export function centroid(pts: LL[]): LL {
  if (!pts.length) return { lat: 0, lng: 0 };
  return { lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length, lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length };
}

export function pathKm(pts: LL[]): number {
  let t = 0;
  for (let i = 1; i < pts.length; i++) t += roadKm(pts[i - 1], pts[i]);
  return t;
}

/** Order indices with nearest-neighbour then 2-opt. `start` is a fixed origin that is not part of the returned order. */
export function optimizeOrder(pts: LL[], start?: LL): number[] {
  const n = pts.length;
  if (n <= 2 && !start) return pts.map((_, i) => i);
  const left = new Set(pts.map((_, i) => i));
  const order: number[] = [];
  let cur: LL | undefined = start;
  if (!cur) {
    // start from the point farthest from the centroid so the tour has a natural end
    const c = centroid(pts);
    let far = 0, fd = -1;
    pts.forEach((p, i) => { const d = haversineKm(c, p); if (d > fd) { fd = d; far = i; } });
    order.push(far); left.delete(far); cur = pts[far];
  }
  while (left.size) {
    let best = -1, bd = Infinity;
    left.forEach((i) => { const d = haversineKm(cur as LL, pts[i]); if (d < bd) { bd = d; best = i; } });
    order.push(best); left.delete(best); cur = pts[best];
  }
  // 2-opt (open path with optional fixed start)
  const seq = () => (start ? [start, ...order.map((i) => pts[i])] : order.map((i) => pts[i]));
  let improved = true, guard = 0;
  while (improved && guard++ < 50) {
    improved = false;
    for (let i = 0; i < order.length - 1; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const cand = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
        const before = pathKm(seq());
        const saved = order.slice();
        order.splice(0, order.length, ...cand);
        if (pathKm(seq()) + 1e-6 < before) improved = true;
        else order.splice(0, order.length, ...saved);
      }
    }
  }
  return order;
}

function kmeans(pts: LL[], k: number): number[] {
  if (k <= 1 || pts.length <= k) return pts.map((_, i) => (k <= 1 ? 0 : i % k));
  // farthest-point init (deterministic)
  const centers: LL[] = [pts[0]];
  while (centers.length < k) {
    let best = 0, bd = -1;
    pts.forEach((p, i) => {
      const d = Math.min(...centers.map((c) => haversineKm(c, p)));
      if (d > bd) { bd = d; best = i; }
    });
    centers.push(pts[best]);
  }
  let assign = new Array(pts.length).fill(0);
  for (let it = 0; it < 15; it++) {
    assign = pts.map((p) => {
      let bi = 0, bd = Infinity;
      centers.forEach((c, i) => { const d = haversineKm(c, p); if (d < bd) { bd = d; bi = i; } });
      return bi;
    });
    for (let i = 0; i < k; i++) {
      const mem = pts.filter((_, idx) => assign[idx] === i);
      if (mem.length) centers[i] = centroid(mem);
    }
  }
  return assign;
}

const PACE_MIN: Record<Pace, number> = { relaxed: 300, balanced: 420, packed: 540 };

/**
 * Split places into geographic day-clusters sized to the pace, order clusters by travel from `start`,
 * and optimise the stop order inside each day.
 */
export function buildDayPlan(places: Place[], pace: Pace, start: LL, hills: boolean, forceDays?: number): string[][] {
  if (!places.length) return [];
  const work = places.reduce((s, p) => s + p.durationMin + 25, 0);
  const k = Math.max(1, Math.min(places.length, forceDays ?? Math.ceil(work / PACE_MIN[pace])));
  const assign = kmeans(places, k);
  const groups: Place[][] = Array.from({ length: k }, () => []);
  places.forEach((p, i) => groups[assign[i]].push(p));
  const nonEmpty = groups.filter((g) => g.length);
  // order clusters greedily from the start point
  const ordered: Place[][] = [];
  let cur = start;
  const remaining = [...nonEmpty];
  while (remaining.length) {
    let bi = 0, bd = Infinity;
    remaining.forEach((g, i) => { const d = haversineKm(cur, centroid(g)); if (d < bd) { bd = d; bi = i; } });
    const [g] = remaining.splice(bi, 1);
    ordered.push(g);
    cur = centroid(g);
  }
  void hills;
  let from = start;
  return ordered.map((g) => {
    const idx = optimizeOrder(g, from);
    const seq = idx.map((i) => g[i]);
    from = seq[seq.length - 1] ?? from;
    return seq.map((p) => p.id);
  });
}

export interface ScheduleItem {
  placeId: string;
  startMin: number;
  endMin: number;
  travelKm: number;
  travelMin: number;
}

export function parseHM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
export function fmtHM(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const ap = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${ap}`;
}
export function fmtDur(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function scheduleDay(ids: string[], places: Record<string, Place>, startTime: string, from: LL, hills: boolean): ScheduleItem[] {
  let t = parseHM(startTime);
  let prev: LL = from;
  const out: ScheduleItem[] = [];
  for (const id of ids) {
    const pl = places[id];
    if (!pl) continue;
    const km = roadKm(prev, pl);
    const tm = driveMin(km, hills);
    t += tm;
    out.push({ placeId: id, startMin: t, endMin: t + pl.durationMin, travelKm: km, travelMin: tm });
    t += pl.durationMin;
    prev = pl;
  }
  return out;
}

export function gmapsPlaceUrl(p: Pick<Place, "name" | "area" | "lat" | "lng">): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.area}`)}&query_place_id=&center=${p.lat},${p.lng}`.replace("&query_place_id=", "");
}

/** Google Maps directions deep link (no API key needed). Max 9 waypoints. */
export function gmapsDirUrl(pts: LL[], mode: "driving" | "walking" | "transit" = "driving"): string {
  if (pts.length < 2) return pts[0] ? `https://www.google.com/maps/search/?api=1&query=${pts[0].lat},${pts[0].lng}` : "https://maps.google.com";
  const f = (p: LL) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
  const mid = pts.slice(1, -1).slice(0, 9).map(f).join("|");
  const q = new URLSearchParams({ api: "1", origin: f(pts[0]), destination: f(pts[pts.length - 1]), travelmode: mode });
  if (mid) q.set("waypoints", mid);
  return `https://www.google.com/maps/dir/?${q.toString()}`;
}
