import { ORIGINS, getDestination } from "./catalog";
import { haversineKm, roadKm } from "./geo";
import type { Trip } from "./types";

export interface Option {
  key: "flight" | "train" | "bus" | "selfdrive" | "cab";
  title: string;
  detail: string;
  hours: number;
  perPerson: number;
  note?: string;
  mmt: string;
  fit: "best" | "good" | "ok";
}

export const MMT_LINKS = {
  flights: "https://www.makemytrip.com/flights/",
  hotels: "https://www.makemytrip.com/hotels/",
  trains: "https://www.makemytrip.com/railways/",
  buses: "https://www.makemytrip.com/bus-tickets/",
  cabs: "https://www.makemytrip.com/cabs/",
  holidays: "https://www.makemytrip.com/holidays-india/",
  homestays: "https://www.makemytrip.com/hotels/",
};

/** Indicative intercity options from the traveller's origin to the trip gateway. Not live fares. */
export function gettingThere(trip: Trip): { km: number; gateway: string; options: Option[] } {
  const dest = getDestination(trip.destinationKey);
  const origin = ORIGINS.find((o) => o.name === trip.origin);
  if (!dest || !origin) return { km: 0, gateway: dest?.gateway.name ?? trip.destination, options: [] };
  const air = haversineKm(origin, dest.gateway);
  const road = roadKm(origin, dest.gateway);
  const n = Math.max(1, trip.members.length);
  const opts: Option[] = [];
  if (air > 350) {
    opts.push({ key: "flight", title: `Flight to ${dest.gateway.name} (${dest.gateway.code})`, detail: `~${Math.round(air)} km by air`, hours: 1.2 + air / 700, perPerson: Math.round((2200 + air * 3.2) / 100) * 100, mmt: MMT_LINKS.flights, fit: air > 900 ? "best" : "good", note: "Fares move daily; set a fare alert on MMT." });
  }
  if (road > 250 && road < 2200) {
    opts.push({ key: "train", title: "Train (AC 3-tier / Sleeper)", detail: `~${Math.round(road)} km by rail`, hours: road / 55 + 1, perPerson: Math.round((350 + road * 1.1) / 50) * 50, mmt: MMT_LINKS.trains, fit: road > 1000 ? "ok" : "good", note: "Book 60 days ahead for peak dates." });
  }
  if (road < 1000) {
    opts.push({ key: "bus", title: "Overnight bus", detail: `~${Math.round(road)} km by road`, hours: road / 45 + 1, perPerson: Math.round((300 + road * 1.4) / 50) * 50, mmt: MMT_LINKS.buses, fit: road < 550 ? "best" : "ok" });
  }
  if (road < 900) {
    const days = Math.max(2, trip.days.length);
    opts.push({ key: "selfdrive", title: "Self-drive rental", detail: `~${Math.round(road)} km one way; group of ${n} shares the car`, hours: road / 50, perPerson: Math.round(((2200 * days + road * 2 * 7) / n) / 50) * 50, mmt: "https://www.zoomcar.com", fit: road < 600 ? "best" : "good", note: "Partner integration in roadmap. Check licence, deposit and hill-road comfort." });
  }
  if (road < 900) opts.push({ key: "cab", title: "Outstation cab with driver (multi-day)", detail: "Same driver for the whole trip, no parking or navigation stress", hours: road / 50, perPerson: Math.round(((road * 2 + trip.days.length * 150) * 13 / n) / 50) * 50, mmt: MMT_LINKS.cabs, fit: n >= 4 ? "best" : "good", note: "Good for hills and groups of 4+." });
  return { km: road, gateway: dest.gateway.name, options: opts };
}

export function localTransport(trip: Trip, kmTotal: number) {
  const n = Math.max(1, trip.members.length);
  const days = trip.days.length;
  return {
    cab: Math.round((kmTotal * 14 + days * 500) / 50) * 50,
    cabPerPerson: Math.round((kmTotal * 14 + days * 500) / n / 50) * 50,
    self: Math.round((days * 2200 + kmTotal * 7) / 50) * 50,
    selfPerPerson: Math.round((days * 2200 + kmTotal * 7) / n / 50) * 50,
  };
}
