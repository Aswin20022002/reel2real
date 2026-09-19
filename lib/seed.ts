import { getDestination } from "./catalog";
import { addDays, buildTripFromAnalysis, isoDate, uid } from "./itinerary";
import { splitAmount } from "./settle";
import type { Analysis, Expense, Place, Trip } from "./types";

/** Demo trip (id "demo") so every screen has data on first open. Names and UPI IDs are fictional. */
export function seedTrip(): Trip {
  const d = getDestination("meghalaya")!;
  const ids = ["mgh-elephant", "mgh-umiam", "mgh-mawlynnong", "mgh-dawki", "mgh-rootbridge", "mgh-nohkalikai", "mgh-cafe-sohra", "mgh-laitlum"];
  const places: Place[] = ids.map((id) => {
    const c = d.places.find((p) => p.id === id)!;
    const { aliases, iconic, ...rest } = c; void aliases; void iconic;
    return { ...rest, fromReel: true, source: "reel", evidence: "From the sample reel caption" };
  });
  const analysis: Analysis = {
    engine: "catalog", destinationKey: "meghalaya", destination: "Meghalaya", title: "Meghalaya hidden waterfalls",
    summary: "Waterfalls, living root bridges and a glass-clear river, from a sample reel.", vibe: d.vibe, places, warnings: [],
    reel: { url: "https://www.instagram.com/reel/sample-meghalaya/", platform: "instagram", author: "@northeast.notes (sample)", title: "Sample reel: Meghalaya hidden waterfalls" },
  };
  const t = buildTripFromAnalysis(analysis, { names: ["Aarav", "Diya", "Kabir", "Meera"], origin: "Mumbai", startDate: addDays(isoDate(new Date()), 21), pace: "balanced" });
  t.id = "demo";
  t.name = "Meghalaya with the gang";
  const [a, b, c, m] = t.members;
  a.upi = "aarav.demo@upi"; b.upi = "diya.demo@upi"; c.upi = "kabir.demo@upi"; m.upi = "meera.demo@upi";
  const all = t.members.map((x) => x.id);
  const now = Date.now();
  const mk = (title: string, amount: number, payer: string, category: Expense["category"], mode: Expense["mode"], dayIndex?: number, among = all): Expense => ({
    id: uid("e"), title, amount, payerId: payer, split: splitAmount(amount, among), category, mode, dayIndex, date: addDays(t.startDate, dayIndex ?? 0), updatedAt: now,
  });
  t.expenses = [
    mk("Advance for cab with driver", 6000, a.id, "transport", "UPI", 0),
    mk("Homestay deposit, Sohra", 4800, b.id, "stay", "UPI", 0),
    mk("Dinner at Police Bazar", 1720, c.id, "food", "Cash", 0),
    mk("Dawki boat (2 boats)", 1600, m.id, "activity", "UPI", 1),
    mk("Snacks and chai", 540, a.id, "food", "Cash", 1, [a.id, b.id, c.id]),
  ];
  t.settlements = [];
  t.bookings = [
    { id: uid("b"), kind: "stay", title: "Homestay in Sohra, 2 nights", status: "booked", amount: 9600, ref: "DEMO-4821", updatedAt: now },
    { id: uid("b"), kind: "flight", title: "Mumbai to Guwahati (shortlisted)", status: "shortlisted", updatedAt: now },
    { id: uid("b"), kind: "cab", title: "Guwahati to Shillong, multi-day cab", status: "idea", updatedAt: now },
  ];
  return t;
}
