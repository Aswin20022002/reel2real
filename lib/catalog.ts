import type { Category, Place, Season } from "./types";

/**
 * A small curated catalog used to (a) snap AI-extracted places onto verified coordinates,
 * (b) offer alternatives / plan-B stops, and (c) let the app work end-to-end with no API keys.
 * Coordinates are approximate (good for routing demos) - Google Places / Nominatim refine them at runtime.
 * Costs are indicative per-person figures in INR, not live prices.
 */
export interface CatalogPlace extends Place {
  aliases: string[];
  iconic?: boolean;
}
export interface Destination {
  key: string;
  name: string;
  region: string;
  aliases: string[];
  gateway: { name: string; code: string; lat: number; lng: number };
  base: { name: string; lat: number; lng: number };
  hills: boolean;
  bestMonths: string;
  defaultDays: number;
  vibe: string[];
  places: CatalogPlace[];
  stays: CatalogPlace[];
}

function p(
  id: string, name: string, category: Category, area: string, lat: number, lng: number,
  description: string, durationMin: number, costINR: number, tags: string[],
  extra: { aliases?: string[]; wiki?: string; indoor?: boolean; iconic?: boolean; season?: Season; nightINR?: number } = {}
): CatalogPlace {
  return {
    id, name, category, area, lat, lng, description, durationMin, costINR, tags,
    wiki: extra.wiki, indoor: extra.indoor, iconic: extra.iconic, season: extra.season, nightINR: extra.nightINR,
    aliases: [name.toLowerCase(), ...(extra.aliases ?? [])], source: "catalog",
  };
}

const meghalaya: Destination = {
  key: "meghalaya", name: "Meghalaya", region: "North-East India",
  aliases: ["meghalaya", "shillong", "cherrapunji", "sohra", "mawlynnong", "dawki", "nongriat", "umngot", "khasi", "scotland of the east"],
  gateway: { name: "Guwahati", code: "GAU", lat: 26.1061, lng: 91.5859 },
  base: { name: "Shillong", lat: 25.5788, lng: 91.8933 },
  hills: true, bestMonths: "Oct-May (waterfalls peak Jun-Sep, but roads and treks get risky)", defaultDays: 4,
  vibe: ["waterfalls", "living root bridges", "homestays", "hidden gems"],
  places: [
    p("mgh-elephant", "Elephant Falls", "nature", "Shillong", 25.5386, 91.8142, "Three-tier waterfall in a fern-lined gorge, 20 minutes from the city.", 45, 30, ["waterfall", "easy"], { aliases: ["elephant falls", "three step"], wiki: "Elephant Falls", iconic: true }),
    p("mgh-peak", "Shillong Peak", "sight", "Shillong", 25.5445, 91.8755, "Highest point around Shillong with a valley viewpoint.", 45, 20, ["viewpoint"], { aliases: ["shillong peak"], wiki: "Shillong Peak" }),
    p("mgh-umiam", "Umiam Lake", "nature", "Ri-Bhoi", 25.6552, 91.89, "Reservoir lake with boating and water sports on the way to Guwahati.", 90, 150, ["lake", "boating"], { aliases: ["umiam", "bara pani"], wiki: "Umiam Lake" }),
    p("mgh-laitlum", "Laitlum Canyons", "nature", "East Khasi Hills", 25.395, 91.906, "Cliff-edge canyon views; a short walk down the steps for the best angle.", 120, 50, ["viewpoint", "walk"], { aliases: ["laitlum", "canyon"] }),
    p("mgh-mawlynnong", "Mawlynnong Village", "culture", "East Khasi Hills", 25.2018, 91.9163, "Tidy Khasi village known for bamboo walkways, gardens and a sky-view platform.", 120, 100, ["village", "photography"], { aliases: ["mawlynnong", "cleanest village"], wiki: "Mawlynnong", iconic: true }),
    p("mgh-dawki", "Dawki & Umngot River boat ride", "nature", "West Jaintia Hills", 25.1861, 92.0233, "Glass-clear river on the Bangladesh border; the boat looks like it floats in air on calm days.", 150, 800, ["river", "boating", "photography"], { aliases: ["dawki", "umngot", "glass water", "crystal clear"], wiki: "Dawki", iconic: true, season: { closedMonths: [6, 7, 8], note: "Heavy monsoon muddies the river and can pause boating." } }),
    p("mgh-rootbridge", "Double Decker Living Root Bridge, Nongriat", "adventure", "Sohra (Cherrapunji)", 25.251, 91.672, "A ~3,000-step descent to a two-tier living root bridge and natural pools. Plan a full half-day.", 300, 100, ["trek", "hidden gem", "root bridge"], { aliases: ["double decker", "root bridge", "nongriat", "living root", "rainbow falls"], wiki: "Living root bridges", iconic: true, season: { closedMonths: [6, 7, 8, 9], note: "Steps turn slippery and leech-heavy in monsoon; avoid right after heavy rain." } }),
    p("mgh-nohkalikai", "Nohkalikai Falls", "nature", "Sohra (Cherrapunji)", 25.2731, 91.689, "One of India's tallest plunge waterfalls, viewed from a cliff-side platform.", 60, 30, ["waterfall", "viewpoint"], { aliases: ["nohkalikai", "noh ka likai"], wiki: "Nohkalikai Falls", iconic: true }),
    p("mgh-cafe-sohra", "Hilltop café stop, Sohra", "food", "Sohra (Cherrapunji)", 25.27, 91.73, "Chai and momos with a valley view; pick a café on Google Maps that is open on your day.", 60, 400, ["cafe", "view"], { aliases: ["cafe", "café", "hilltop cafe", "hills cafe", "coffee"], indoor: true }),
    p("mgh-khasi-meal", "Khasi meals at Police Bazar", "food", "Shillong", 25.5716, 91.8801, "Jadoh, dohneiiong and tungrymbai at a local eatery in the city centre.", 75, 350, ["local food"], { aliases: ["jadoh", "khasi food", "police bazar", "local food"], indoor: true }),
    p("mgh-cathedral", "Cathedral of Mary Help of Christians", "culture", "Shillong", 25.5709, 91.879, "Calm indoor stop in the city, good on rainy afternoons.", 45, 0, ["indoor", "heritage"], { aliases: ["cathedral"], indoor: true }),
  ],
  stays: [
    p("mgh-stay-shillong", "Boutique stay in Shillong", "stay", "Shillong", 25.5788, 91.8933, "City base close to Police Bazar.", 0, 0, ["stay"], { nightINR: 3500 }),
    p("mgh-stay-sohra", "Homestay in Sohra", "stay", "Sohra (Cherrapunji)", 25.27, 91.732, "Close to the falls and the Nongriat trailhead.", 0, 0, ["stay"], { nightINR: 2500 }),
    p("mgh-stay-nongriat", "Village homestay, Nongriat", "stay", "Nongriat", 25.25, 91.673, "Basic rooms beside the root bridges; carry a torch and cash.", 0, 0, ["stay", "offbeat"], { nightINR: 1800 }),
    p("mgh-stay-mawlynnong", "Bamboo homestay, Mawlynnong", "stay", "Mawlynnong", 25.2015, 91.916, "Village stay near Dawki.", 0, 0, ["stay", "offbeat"], { nightINR: 2200 }),
  ].map((s) => ({ ...s, aliases: [s.name.toLowerCase()] })),
};

const goa: Destination = {
  key: "goa", name: "Goa", region: "West India",
  aliases: ["goa", "palolem", "baga", "anjuna", "vagator", "panjim", "panaji", "dudhsagar", "fontainhas", "south goa", "north goa"],
  gateway: { name: "Goa (Dabolim)", code: "GOI", lat: 15.3808, lng: 73.8314 },
  base: { name: "Panaji", lat: 15.4909, lng: 73.8278 },
  hills: false, bestMonths: "Nov-Feb (shacks and water sports run Oct-May)", defaultDays: 4,
  vibe: ["beaches", "heritage", "forts", "slow days"],
  places: [
    p("goa-baga", "Baga Beach", "nature", "North Goa", 15.5553, 73.7517, "Busy beach with water sports and shacks.", 120, 500, ["beach", "water sports"], { aliases: ["baga"], wiki: "Baga, Goa" }),
    p("goa-chapora", "Chapora Fort", "sight", "North Goa", 15.6055, 73.7377, "Ruined hilltop fort with sweeping coastal views, best near sunset.", 60, 0, ["fort", "sunset"], { aliases: ["chapora", "dil chahta hai"], wiki: "Chapora Fort", iconic: true }),
    p("goa-bomjesus", "Basilica of Bom Jesus", "culture", "Old Goa", 15.5009, 73.9116, "UNESCO-listed baroque church in Old Goa.", 60, 0, ["heritage", "church"], { aliases: ["bom jesus", "old goa", "basilica"], wiki: "Basilica of Bom Jesus", indoor: true, iconic: true }),
    p("goa-fontainhas", "Fontainhas Latin Quarter walk", "culture", "Panaji", 15.4966, 73.833, "Colourful Portuguese-era lanes, galleries and cafés.", 90, 200, ["heritage", "walk", "cafes"], { aliases: ["fontainhas", "latin quarter", "panjim heritage"], wiki: "Fontainhas", iconic: true }),
    p("goa-dudhsagar", "Dudhsagar Falls jeep safari", "adventure", "South Goa", 15.3144, 74.3143, "Four-tier waterfall on the Goa-Karnataka border reached by jeep from Kulem.", 300, 1500, ["waterfall", "jeep"], { aliases: ["dudhsagar", "dudh sagar", "milk falls"], wiki: "Dudhsagar Falls", season: { closedMonths: [6, 7, 8, 9], note: "Jeep safaris usually pause in monsoon." } }),
    p("goa-palolem", "Palolem Beach", "nature", "South Goa", 15.01, 74.0232, "Crescent bay with calm water and beach huts.", 180, 300, ["beach", "sunrise"], { aliases: ["palolem", "south goa beach"], wiki: "Palolem Beach", iconic: true, season: { closedMonths: [6, 7, 8], note: "Beach shacks and huts are mostly dismantled during monsoon." } }),
    p("goa-caboderama", "Cabo de Rama Fort", "sight", "South Goa", 15.0898, 73.9273, "Quiet cliffside fort with sea views and few crowds.", 90, 0, ["fort", "sunset", "offbeat"], { aliases: ["cabo de rama", "cabo"], wiki: "Cabo de Rama Fort" }),
    p("goa-aguada", "Fort Aguada", "sight", "North Goa", 15.4926, 73.7736, "17th-century Portuguese fort and lighthouse.", 60, 25, ["fort"], { aliases: ["aguada"], wiki: "Fort Aguada" }),
    p("goa-spice", "Spice plantation lunch, Ponda", "culture", "Ponda", 15.403, 74.018, "Guided plantation walk followed by a Goan lunch.", 150, 600, ["food", "family"], { aliases: ["spice plantation", "ponda", "spice farm"], indoor: false }),
  ],
  stays: [
    p("goa-stay-palolem", "Beach hut, Palolem", "stay", "Palolem", 15.01, 74.023, "Simple huts steps from the sand.", 0, 0, ["stay"], { nightINR: 3000 }),
    p("goa-stay-panjim", "Heritage homestay, Fontainhas", "stay", "Panaji", 15.4966, 73.833, "Portuguese-style house in the old quarter.", 0, 0, ["stay"], { nightINR: 4200 }),
    p("goa-stay-anjuna", "Boutique stay, Anjuna-Vagator", "stay", "North Goa", 15.573, 73.741, "Base for forts, flea markets and nightlife.", 0, 0, ["stay"], { nightINR: 3500 }),
  ].map((s) => ({ ...s, aliases: [s.name.toLowerCase()] })),
};

const himachal: Destination = {
  key: "himachal", name: "Manali & Kasol", region: "Himachal Pradesh",
  aliases: ["manali", "kasol", "himachal", "solang", "old manali", "parvati", "kullu", "naggar", "hadimba", "jogini", "manikaran"],
  gateway: { name: "Kullu-Manali (Bhuntar)", code: "KUU", lat: 31.8767, lng: 77.1544 },
  base: { name: "Manali", lat: 32.2432, lng: 77.1892 },
  hills: true, bestMonths: "Mar-Jun and Sep-Nov (snow Dec-Feb)", defaultDays: 5,
  vibe: ["cafés", "mountains", "river valleys", "treks"],
  places: [
    p("hp-hadimba", "Hadimba Devi Temple", "culture", "Manali", 32.2483, 77.1773, "Wooden pagoda-style temple among deodar forest.", 45, 0, ["temple", "heritage"], { aliases: ["hadimba"], wiki: "Hadimba Devi Temple", iconic: true }),
    p("hp-oldmanali", "Old Manali café hopping", "food", "Old Manali", 32.256, 77.176, "Riverside cafés, live music and bakeries.", 120, 500, ["cafe", "food"], { aliases: ["old manali", "cafe", "cafes", "café"], wiki: "Old Manali", indoor: true, iconic: true }),
    p("hp-jogini", "Jogini Falls trek", "adventure", "Vashisht", 32.2645, 77.1955, "Short forest trail from Vashisht to a two-stage waterfall.", 150, 0, ["trek", "waterfall"], { aliases: ["jogini", "vashisht"], season: { closedMonths: [7, 8], note: "Trail can be slippery or unsafe in peak monsoon." } }),
    p("hp-solang", "Solang Valley", "adventure", "Solang", 32.316, 77.158, "Meadow with paragliding, ropeway and (in winter) snow activities.", 180, 1200, ["adventure", "paragliding", "snow"], { aliases: ["solang", "paragliding"], wiki: "Solang Valley", iconic: true }),
    p("hp-naggar", "Naggar Castle", "culture", "Naggar", 32.116, 77.173, "Heritage castle above the Kullu valley with art gallery.", 90, 100, ["heritage", "view"], { aliases: ["naggar"], wiki: "Naggar Castle" }),
    p("hp-kasol", "Kasol riverside", "nature", "Parvati Valley", 32.01, 77.315, "Parvati river village with cafés and pine forest walks.", 240, 300, ["river", "cafe"], { aliases: ["kasol", "parvati valley"], wiki: "Kasol", iconic: true }),
    p("hp-manikaran", "Manikaran Sahib", "culture", "Parvati Valley", 32.0293, 77.3475, "Gurdwara and hot springs; the langar is a highlight.", 90, 0, ["gurdwara", "hot spring"], { aliases: ["manikaran"], wiki: "Manikaran" }),
    p("hp-mall", "Mall Road, Manali", "shopping", "Manali", 32.2396, 77.1887, "Evening walk, Himachali shawls and street food.", 90, 500, ["shopping", "food"], { aliases: ["mall road"] }),
    p("hp-gompa", "Gadhan Thekchhokling Gompa", "culture", "Manali", 32.2453, 77.1878, "Tibetan monastery, a quiet indoor stop.", 40, 0, ["monastery", "indoor"], { aliases: ["gompa", "monastery"], indoor: true }),
  ],
  stays: [
    p("hp-stay-manali", "Riverside stay, Old Manali", "stay", "Old Manali", 32.256, 77.176, "Walkable to cafés.", 0, 0, ["stay"], { nightINR: 3200 }),
    p("hp-stay-kasol", "Café-camp stay, Kasol", "stay", "Kasol", 32.01, 77.315, "Riverside cabins and camps.", 0, 0, ["stay"], { nightINR: 1800 }),
    p("hp-stay-naggar", "Heritage stay, Naggar", "stay", "Naggar", 32.116, 77.173, "Quiet valley base.", 0, 0, ["stay"], { nightINR: 4500 }),
  ].map((s) => ({ ...s, aliases: [s.name.toLowerCase()] })),
};

const kerala: Destination = {
  key: "kerala", name: "Kerala", region: "South India",
  aliases: ["kerala", "munnar", "alleppey", "alappuzha", "kochi", "cochin", "fort kochi", "backwaters", "houseboat", "athirappilly", "kumarakom", "god's own country"],
  gateway: { name: "Kochi", code: "COK", lat: 10.152, lng: 76.4019 },
  base: { name: "Munnar", lat: 10.0889, lng: 77.0595 },
  hills: true, bestMonths: "Sep-Mar (monsoon Jun-Aug is lush but wet)", defaultDays: 5,
  vibe: ["tea hills", "backwaters", "waterfalls", "heritage"],
  places: [
    p("ker-eravikulam", "Eravikulam National Park", "nature", "Munnar", 10.159, 77.055, "Grassland plateau, home of the Nilgiri tahr.", 180, 300, ["wildlife", "trek"], { aliases: ["eravikulam", "rajamalai", "nilgiri tahr"], wiki: "Eravikulam National Park", iconic: true, season: { closedMonths: [2, 3], note: "Usually closed for the calving season around Feb-Mar; check dates." } }),
    p("ker-teamuseum", "Tea Museum & tea estate walk", "culture", "Munnar", 10.085, 77.0655, "Tea-making history and a walk through the estate.", 75, 125, ["tea", "indoor"], { aliases: ["tea museum", "tea estate", "tea gardens", "tea trails"], wiki: "Munnar", indoor: true }),
    p("ker-mattupetty", "Mattupetty Dam", "nature", "Munnar", 10.1064, 77.1244, "Dam reservoir with boating and pine-lined views.", 60, 50, ["dam", "boating"], { aliases: ["mattupetty"], wiki: "Mattupetty Dam" }),
    p("ker-topstation", "Top Station viewpoint", "sight", "Munnar", 10.117, 77.237, "Highest point on the Munnar-Kodaikanal road with valley views.", 90, 0, ["viewpoint"], { aliases: ["top station"] }),
    p("ker-athirappilly", "Athirappilly Falls", "nature", "Thrissur", 10.2851, 76.5698, "Wide horsetail waterfall in the Western Ghats forest.", 120, 100, ["waterfall"], { aliases: ["athirappilly", "athirapally"], wiki: "Athirappilly Falls", iconic: true }),
    p("ker-alleppey", "Alleppey backwater houseboat cruise", "sight", "Alappuzha", 9.4981, 76.3388, "Kettuvallam houseboat through the canals and lagoons.", 360, 3000, ["backwaters", "houseboat"], { aliases: ["alleppey", "alappuzha", "houseboat", "backwaters"], wiki: "Alappuzha", iconic: true }),
    p("ker-kumarakom", "Kumarakom Bird Sanctuary", "nature", "Kottayam", 9.6217, 76.43, "Migratory-bird sanctuary on Vembanad Lake.", 120, 150, ["birds", "boating"], { aliases: ["kumarakom"], wiki: "Kumarakom" }),
    p("ker-fortkochi", "Fort Kochi Chinese fishing nets", "sight", "Fort Kochi", 9.9658, 76.2418, "Cantilevered nets at the harbour; good at sunset.", 60, 0, ["heritage", "sunset"], { aliases: ["fort kochi", "chinese fishing nets"], wiki: "Chinese fishing nets" }),
    p("ker-kathakali", "Kathakali performance, Fort Kochi", "culture", "Fort Kochi", 9.969, 76.243, "Evening classical dance-drama, including make-up demonstration.", 90, 400, ["performance", "indoor"], { aliases: ["kathakali"], indoor: true }),
  ],
  stays: [
    p("ker-stay-munnar", "Plantation stay, Munnar", "stay", "Munnar", 10.0889, 77.0595, "Rooms among the tea estates.", 0, 0, ["stay"], { nightINR: 4000 }),
    p("ker-stay-alleppey", "Lakeside homestay, Alleppey", "stay", "Alappuzha", 9.4981, 76.3388, "Canal-side rooms; houseboat optional.", 0, 0, ["stay"], { nightINR: 3500 }),
    p("ker-stay-fortkochi", "Heritage homestay, Fort Kochi", "stay", "Fort Kochi", 9.9658, 76.242, "Restored colonial-era house.", 0, 0, ["stay"], { nightINR: 4500 }),
  ].map((s) => ({ ...s, aliases: [s.name.toLowerCase()] })),
};

export const DESTINATIONS: Destination[] = [meghalaya, goa, himachal, kerala];

export const ORIGINS: { name: string; lat: number; lng: number }[] = [
  { name: "Mumbai", lat: 19.076, lng: 72.8777 },
  { name: "Delhi", lat: 28.6139, lng: 77.209 },
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { name: "Hyderabad", lat: 17.385, lng: 78.4867 },
  { name: "Kolkata", lat: 22.5726, lng: 88.3639 },
  { name: "Chennai", lat: 13.0827, lng: 80.2707 },
  { name: "Pune", lat: 18.5204, lng: 73.8567 },
  { name: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
];

export function getDestination(key?: string): Destination | undefined {
  return DESTINATIONS.find((d) => d.key === key);
}

export function allCatalogPlaces(): CatalogPlace[] {
  return DESTINATIONS.flatMap((d) => [...d.places, ...d.stays]);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s']/g, " ").replace(/\s+/g, " ").trim();

export function findDestination(text: string): Destination | undefined {
  const t = " " + norm(text) + " ";
  let best: { d: Destination; score: number } | undefined;
  for (const d of DESTINATIONS) {
    let score = 0;
    for (const a of d.aliases) if (t.includes(" " + norm(a) + " ")) score += a.length > 6 ? 3 : 2;
    for (const pl of d.places) for (const a of pl.aliases) if (a.length > 4 && t.includes(" " + norm(a) + " ")) score += 1;
    if (score > 0 && (!best || score > best.score)) best = { d, score };
  }
  return best?.d;
}

export function matchPlaces(text: string, d: Destination): { place: CatalogPlace; hit: string }[] {
  const t = " " + norm(text) + " ";
  const out: { place: CatalogPlace; hit: string }[] = [];
  for (const pl of d.places) {
    const hit = pl.aliases.find((a) => {
      if (a.length <= 3) return false;
      const needle = " " + norm(a) + " ";
      const at = t.indexOf(needle);
      if (at < 0) return false;
      // ignore places the creator tells you to skip ("skip Baga", "instead of Baga")
      return !/(skip|avoid|not|without|instead of|forget)\s*$/.test(t.slice(Math.max(0, at - 14), at));
    });
    if (hit) out.push({ place: pl, hit });
  }
  return out;
}

/** Fuzzy match a free-text place name to a catalog entry anywhere in the catalog. */
export function snapToCatalog(name: string, destKey?: string): CatalogPlace | undefined {
  const n = norm(name);
  if (!n) return undefined;
  const pools = destKey ? [getDestination(destKey)?.places ?? [], allCatalogPlaces()] : [allCatalogPlaces()];
  for (const pool of pools) {
    const exact = pool.find((c) => norm(c.name) === n || c.aliases.some((a) => norm(a) === n));
    if (exact) return exact;
    const partial = pool.find((c) => c.aliases.some((a) => a.length > 4 && (n.includes(norm(a)) || (norm(a).includes(n) && n.length > 5))));
    if (partial) return partial;
  }
  return undefined;
}

export interface SampleReel {
  id: string;
  label: string;
  url: string;
  author: string;
  caption: string;
}
/** Sample captions so the analyzer can be demoed without a live reel. They are written for this prototype, not scraped. */
export const SAMPLES: SampleReel[] = [
  {
    id: "meghalaya", label: "Meghalaya hidden waterfalls", url: "https://www.instagram.com/reel/sample-meghalaya/", author: "@northeast.notes (sample)",
    caption: "Nobody told me Meghalaya looks like this. Day 1 Shillong: Elephant Falls + Umiam Lake. Day 2: Mawlynnong village then Dawki where the boat floats on glass clear water. Day 3: trek to the double decker root bridge in Nongriat, Nohkalikai falls, coffee at a hilltop cafe in Sohra. Stay in a homestay. #meghalaya #hiddengems",
  },
  {
    id: "goa", label: "South Goa slow days", url: "https://www.instagram.com/reel/sample-goa/", author: "@slowtrips.in (sample)",
    caption: "Skip Baga this time. South Goa slow days: sunrise at Palolem, Cabo de Rama fort at sunset, Fontainhas heritage walk in Panjim, Bom Jesus in Old Goa, and Dudhsagar jeep safari if you're up for it. #goa #southgoa",
  },
  {
    id: "himachal", label: "Manali + Kasol cafe trail", url: "https://www.instagram.com/reel/sample-manali/", author: "@hillsandchai (sample)",
    caption: "Manali cafe trail: Old Manali cafes, Hadimba temple, Jogini falls hike, Solang valley paragliding, then a weekend in Kasol by the Parvati river with Manikaran hot springs. #manali #kasol",
  },
  {
    id: "kerala", label: "Kerala tea hills to backwaters", url: "https://www.instagram.com/reel/sample-kerala/", author: "@keralaroutes (sample)",
    caption: "Kerala in 5 days: Munnar tea estates and Eravikulam, Mattupetty dam, Athirappilly falls, Alleppey houseboat through the backwaters, Fort Kochi sunset at the fishing nets and a Kathakali show. #kerala #munnar",
  },
];
