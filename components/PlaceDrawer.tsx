"use client";
import { CalendarClock, ExternalLink, Film, ImageOff, Instagram, MapPin, Star, TriangleAlert, Youtube } from "lucide-react";
import { useEffect, useState } from "react";
import { gmapsPlaceUrl } from "@/lib/geo";
import { dayDate, fmtDate, inr } from "@/lib/itinerary";
import type { Place, Trip } from "@/lib/types";
import { CatChip, Modal } from "./ui";

interface Intel {
  mode: "live" | "basic"; status?: string; rating?: number; ratingCount?: number; hours?: string[]; mapsUri?: string;
  photos: { url: string; credit?: string }[]; reviews: { text: string; when: string; rating?: number }[]; summary?: string; note?: string;
}

export default function PlaceDrawer({ place, trip, onClose }: { place: Place; trip: Trip; onClose: () => void }) {
  const [intel, setIntel] = useState<Intel | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams({ name: place.name, area: place.area, lat: String(place.lat), lng: String(place.lng), wiki: place.wiki ?? "" });
    fetch(`/api/place-intel?${q}`).then((r) => r.json()).then(setIntel).catch(() => setFailed(true));
  }, [place]);

  const di = trip.days.findIndex((d) => d.placeIds.includes(place.id));
  const month = di >= 0 ? new Date(dayDate(trip, di) + "T00:00:00").getMonth() + 1 : new Date(trip.startDate + "T00:00:00").getMonth() + 1;
  const seasonal = place.season?.closedMonths.includes(month);
  const tag = place.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const closed = intel?.status && intel.status !== "OPERATIONAL";

  return (
    <Modal title={place.name} onClose={onClose} wide>
      <div className="flex flex-wrap items-center gap-2"><CatChip c={place.category} /><span className="text-sm text-ink-500">{place.area}</span>{place.fromReel && <span className="chip bg-signal-50 text-signal-700"><Film size={12} /> from your reel</span>}</div>
      <p className="mt-2 text-sm text-ink-700">{place.description}</p>
      {place.evidence && <p className="mt-1 text-xs text-ink-500">What the reel said: {place.evidence}</p>}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {intel?.photos.length ? intel.photos.slice(0, 6).map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={p.url} alt={`${place.name}${p.credit ? `, photo by ${p.credit}` : ""}`} className="h-28 w-full rounded-lg object-cover" loading="lazy" />
        )) : (
          <div className="col-span-full flex h-28 items-center justify-center gap-2 rounded-lg bg-ink-50 text-sm text-ink-500"><ImageOff size={16} /> {failed ? "Photos unavailable" : intel ? "No photo found yet" : "Loading photos..."}</div>
        )}
      </div>
      {intel?.photos[0]?.credit && <p className="mt-1 text-[11px] text-ink-500">Photo: {intel.photos[0].credit}</p>}

      <h3 className="mt-5 font-display text-lg font-bold">Reality check for {fmtDate(dayDate(trip, Math.max(0, di)))}</h3>
      <div className="mt-2 space-y-2 text-sm">
        {seasonal && <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-amber-700"><TriangleAlert size={16} className="mt-0.5 shrink-0" /> {place.season?.note} Consider a swap for this date.</div>}
        {!seasonal && place.season && <div className="flex gap-2 rounded-lg bg-lagoon-50 p-3 text-lagoon-700"><CalendarClock size={16} className="mt-0.5 shrink-0" /> Not in this place's typical closed or risky months. Note: {place.season.note}</div>}
        {intel?.mode === "live" && (
          <div className={`rounded-lg p-3 ${closed ? "bg-signal-50 text-signal-700" : "bg-lagoon-50 text-lagoon-700"}`}>
            <div className="flex items-center gap-2 font-semibold">
              {closed ? <TriangleAlert size={16} /> : <Star size={16} />}
              {closed ? `Google lists this as ${intel.status?.replace(/_/g, " ").toLowerCase()}` : "Listed as open"}
              {intel.rating ? ` · ${intel.rating.toFixed(1)} from ${intel.ratingCount?.toLocaleString("en-IN")} reviews` : ""}
            </div>
          </div>
        )}
        {intel?.reviews.length ? (
          <ul className="space-y-2">{intel.reviews.map((r, i) => <li key={i} className="rounded-lg border border-ink-100 p-2.5"><div className="text-xs text-ink-500">{r.when}{r.rating ? ` · ${r.rating}★` : ""}</div><p>{r.text}</p></li>)}</ul>
        ) : null}
        {intel?.mode === "basic" && intel.note && <p className="text-xs text-ink-500">{intel.note}</p>}
        {intel?.summary && <p className="text-ink-700">{intel.summary}</p>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a className="btn-ghost btn-sm" target="_blank" rel="noreferrer" href={intel?.mapsUri || gmapsPlaceUrl(place)}><MapPin size={14} /> Open in Google Maps <ExternalLink size={12} /></a>
        <a className="btn-ghost btn-sm" target="_blank" rel="noreferrer" href={`https://www.instagram.com/explore/tags/${tag}/`}><Instagram size={14} /> Recent posts on Instagram</a>
        <a className="btn-ghost btn-sm" target="_blank" rel="noreferrer" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(place.name + " " + place.area + " vlog")}`}><Youtube size={14} /> Recent vlogs</a>
      </div>
      <p className="mt-3 text-xs text-ink-500">Typical spend {place.costINR ? inr(place.costINR) + " per person" : "free or negligible"} · about {place.durationMin >= 60 ? `${Math.round((place.durationMin / 60) * 10) / 10} h` : `${place.durationMin} min`} on site. Indicative, so confirm locally.</p>
    </Modal>
  );
}
