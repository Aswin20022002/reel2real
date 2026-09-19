import { stops } from "./itinerary";
import type { DayWeather, Trip } from "./types";
import { isWet, wxLabel } from "./weather";

export interface PackItem { id: string; name: string; qty?: string; why: string }
export interface PackGroup { title: string; items: PackItem[] }
export interface PackPlan {
  groups: PackGroup[];
  skip: { name: string; why: string }[];
  perDay: { dayIndex: number; outfit: string }[];
  bag: string;
  summary: string;
}

/** Rule-based packing plan from weather + the actual stops in the itinerary. Deterministic, so it also works offline. */
export function buildPacking(trip: Trip, wx: (DayWeather | undefined)[]): PackPlan {
  const known = wx.filter(Boolean) as DayWeather[];
  const s = stops(trip);
  const tags = new Set(s.flatMap((p) => p.tags));
  const has = (t: string) => tags.has(t);
  const days = trip.days.length;
  const tmin = known.length ? Math.min(...known.map((d) => d.tmin)) : 18;
  const tmax = known.length ? Math.max(...known.map((d) => d.tmax)) : 30;
  const wetDays = known.filter(isWet).length;
  const anyWet = wetDays > 0;
  const uv = known.some((d) => (d.uv ?? 0) >= 7) || tmax >= 30;
  const trek = has("trek") || s.some((p) => p.category === "adventure");
  const water = has("beach") || has("boating") || has("water sports") || has("river") || has("houseboat");
  const temple = has("temple") || has("gurdwara") || has("monastery") || has("church") || has("heritage");
  const cold = tmin < 12;
  const cool = tmin < 18;

  const tops = Math.min(days, 4) + (tmax > 30 ? 1 : 0);
  const bottoms = Math.min(Math.ceil(days / 2) + 1, 4);
  const clothes: PackItem[] = [
    { id: "tops", name: "T-shirts / tops", qty: String(tops), why: days > 4 ? "Rewear or wash once; you won't need one per day." : "One per day." },
    { id: "bottoms", name: "Trousers / shorts", qty: String(bottoms), why: "Bottoms can be worn twice." },
    { id: "under", name: "Innerwear & socks", qty: String(Math.min(days + 1, 5)), why: "One extra pair; quick-dry ones can be washed overnight." },
    { id: "sleep", name: "Sleepwear", qty: "1", why: "" },
  ];
  if (tmax > 29) clothes.push({ id: "cotton", name: "Breathable cotton / linen top", qty: "2", why: `Highs around ${Math.round(tmax)}°C.` });
  if (cool) clothes.push({ id: "fleece", name: "Fleece or light sweater", qty: "1", why: `Lows around ${Math.round(tmin)}°C in the evenings.` });
  if (cold) clothes.push({ id: "jacket", name: "Padded / down jacket", qty: "1", why: `Lows near ${Math.round(tmin)}°C; thermals help more than a second jacket.` }, { id: "thermal", name: "Thermal inner set", qty: "1", why: "Layering is lighter than a heavy coat." });
  if (temple) clothes.push({ id: "modest", name: "Modest outfit / shawl", qty: "1", why: "Temples, gurdwaras and churches expect covered shoulders and knees." });
  if (water) clothes.push({ id: "swim", name: "Swimwear + quick-dry towel", qty: "1", why: "Beach, river or boat stops on the plan." });

  const gear: PackItem[] = [];
  if (anyWet) gear.push({ id: "poncho", name: "Poncho or compact umbrella", qty: "1", why: `${wetDays} of ${known.length} forecast days look wet.` }, { id: "drybag", name: "Waterproof phone pouch / dry bag", qty: "1", why: "Keeps phone and documents dry." }, { id: "xsocks", name: "Extra socks", qty: "2", why: "Wet shoes and socks are the main comfort killer." });
  if (trek) gear.push({ id: "shoes", name: "Grippy trekking shoes", qty: "1 pair", why: "Trek or waterfall stops in the plan." }, { id: "torch", name: "Torch / headlamp", qty: "1", why: "Village stays and early starts." });
  if (trek && anyWet) gear.push({ id: "leech", name: "Leech-proof socks", qty: "1", why: "Forest trails in wet conditions." });
  if (uv) gear.push({ id: "sun", name: "Sunscreen, cap, sunglasses", why: "High UV or heat on the itinerary." });
  gear.push({ id: "slip", name: "Comfortable walking sandals", qty: "1", why: "Easy on/off for temples and homestays." });

  const essentials: PackItem[] = [
    { id: "id", name: "Photo ID + booking confirmations (offline copies)", why: "Network drops in hills and villages." },
    { id: "cash", name: "Some cash in small notes", why: "Village stays, entry fees and local guides often don't take cards." },
    { id: "power", name: "Power bank + charging cable", why: "Long drives and remote stays." },
    { id: "meds", name: "Personal medicines, ORS, band-aids", why: "Pharmacies are far from remote stops." },
    { id: "bottle", name: "Refillable water bottle", why: "" },
  ];

  const skip: { name: string; why: string }[] = [];
  if (!cool) skip.push({ name: "Sweaters and jackets", why: `Lows stay near ${Math.round(tmin)}°C.` });
  if (!anyWet && known.length) skip.push({ name: "Raincoat and umbrella", why: "No wet days in the forecast window." });
  if (!water) skip.push({ name: "Swimwear", why: "No beach, river or boat stops in the plan." });
  if (!trek) skip.push({ name: "Trekking shoes", why: "No trek-type stops planned." });
  skip.push({ name: "Formal wear and more than 2 pairs of shoes", why: "They add weight and this itinerary doesn't need them." });

  const perDay = trip.days.map((d, i) => {
    const w = wx[i];
    const pl = d.placeIds.map((id) => trip.places[id]).filter(Boolean);
    const bits: string[] = [];
    if (w) {
      bits.push(`${Math.round(w.tmin)}-${Math.round(w.tmax)}°C, ${wxLabel(w.code).label.toLowerCase()}`);
      if (w.tmin < 15) bits.push("carry a warm layer");
      if (isWet(w)) bits.push("rain gear on top");
      if ((w.uv ?? 0) >= 7 || w.tmax >= 32) bits.push("sun cover");
    }
    if (pl.some((p) => p.category === "adventure" || p.tags.includes("trek"))) bits.push("shoes with grip");
    if (pl.some((p) => p.tags.includes("temple") || p.tags.includes("gurdwara") || p.tags.includes("monastery") || p.tags.includes("church"))) bits.push("covered shoulders and knees");
    if (pl.some((p) => p.tags.includes("beach") || p.tags.includes("boating") || p.tags.includes("river"))) bits.push("swim kit in the day bag");
    return { dayIndex: i, outfit: bits.length ? bits.join("; ") : "Easy layers" };
  });

  const bag = days <= 3 ? "A 40 L backpack or 7 kg cabin bag is enough." : days <= 6 ? "One 45-55 L bag per person; plan one laundry stop." : "One medium bag plus a day pack; plan two laundry stops.";
  const summary = known.length
    ? `Expect ${Math.round(tmin)}-${Math.round(tmax)}°C${anyWet ? ` with rain on ${wetDays} of ${known.length} days` : " and mostly dry days"}. Pack for layers, not for every possible weather.`
    : "Weather isn't loaded yet, so this list uses the stops in your plan.";

  return {
    groups: [
      { title: "Clothes", items: clothes },
      { title: "Gear for your stops", items: gear },
      { title: "Essentials", items: essentials },
    ],
    skip,
    perDay,
    bag,
    summary,
  };
}
