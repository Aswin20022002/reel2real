"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { mergeTrips } from "./merge";
import { seedTrip } from "./seed";
import { getSupabase } from "./supabase";
import type { SavedReel, Trip } from "./types";

const TKEY = (id: string) => `r2r:trip:${id}`;
const LIST = "r2r:trips";
const ok = () => typeof window !== "undefined";

export interface TripListItem { id: string; name: string; destination: string; startDate: string }

export function listTrips(): TripListItem[] {
  if (!ok()) return [];
  try { return JSON.parse(localStorage.getItem(LIST) || "[]"); } catch { return []; }
}
function rememberTrip(t: Trip) {
  if (!ok()) return;
  const list = listTrips().filter((x) => x.id !== t.id);
  list.unshift({ id: t.id, name: t.name, destination: t.destination, startDate: t.startDate });
  localStorage.setItem(LIST, JSON.stringify(list.slice(0, 20)));
}
export function loadLocal(id: string): Trip | null {
  if (!ok()) return null;
  try { const s = localStorage.getItem(TKEY(id)); return s ? (JSON.parse(s) as Trip) : null; } catch { return null; }
}
export function saveLocal(t: Trip) {
  if (!ok()) return;
  localStorage.setItem(TKEY(t.id), JSON.stringify(t));
  rememberTrip(t);
}

export const getMe = (tripId: string) => (ok() ? localStorage.getItem(`r2r:me:${tripId}`) : null);
export const setMeStored = (tripId: string, memberId: string) => ok() && localStorage.setItem(`r2r:me:${tripId}`, memberId);

export const cloudEnabled = () => !!getSupabase();

export async function fetchTrip(id: string): Promise<Trip | null> {
  const sb = getSupabase();
  if (sb && id !== "demo") {
    const { data, error } = await sb.from("trips").select("data").eq("id", id).maybeSingle();
    if (!error && data?.data) { const t = data.data as Trip; saveLocal(t); return t; }
  }
  const local = loadLocal(id);
  if (local) return local;
  if (id === "demo") { const s = seedTrip(); saveLocal(s); return s; }
  return null;
}

/** Persist a trip. In cloud mode: merge with the latest remote copy first so concurrent edits don't clobber each other. */
export async function pushTrip(t: Trip): Promise<Trip> {
  saveLocal(t);
  const sb = getSupabase();
  if (!sb || t.id === "demo") return t;
  try {
    const { data } = await sb.from("trips").select("data").eq("id", t.id).maybeSingle();
    const merged = data?.data ? mergeTrips(data.data as Trip, t) : t;
    await sb.from("trips").upsert({ id: t.id, data: merged, updated_at: new Date().toISOString() });
    saveLocal(merged);
    return merged;
  } catch (e) {
    console.error("Cloud save failed, kept locally", e);
    return t;
  }
}

export function useTrip(id: string) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const ref = useRef<Trip | null>(null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  const apply = useCallback((t: Trip) => {
    if (ref.current && JSON.stringify(ref.current) === JSON.stringify(t)) return;
    ref.current = t;
    setTrip(t);
  }, []);

  useEffect(() => {
    let alive = true;
    fetchTrip(id).then((t) => { if (!alive) return; if (t) apply(t); setLoading(false); });
    const onStorage = (e: StorageEvent) => {
      if (e.key === TKEY(id) && e.newValue) { try { const t = JSON.parse(e.newValue) as Trip; apply(ref.current ? mergeTrips(t, ref.current) : t); } catch { /* ignore */ } }
    };
    window.addEventListener("storage", onStorage);
    const sb = getSupabase();
    const ch = sb && id !== "demo"
      ? sb.channel(`trip-${id}`).on("postgres_changes", { event: "*", schema: "public", table: "trips", filter: `id=eq.${id}` }, (payload) => {
          const remote = (payload.new as { data?: Trip })?.data;
          if (remote && ref.current) apply(mergeTrips(remote, ref.current));
        }).subscribe()
      : null;
    return () => { alive = false; window.removeEventListener("storage", onStorage); if (sb && ch) sb.removeChannel(ch); };
  }, [id, apply]);

  const update = useCallback((fn: (t: Trip) => Trip) => {
    const cur = ref.current;
    if (!cur) return;
    const next = fn(cur);
    if (next === cur) return;
    const stamped = { ...next, updatedAt: Math.max(next.updatedAt, Date.now()) };
    ref.current = stamped;
    setTrip(stamped);
    chain.current = chain.current.then(() => pushTrip(stamped)).then((merged) => { if (merged) apply(ref.current ? mergeTrips(merged, ref.current) : merged); });
  }, [apply]);

  return { trip, loading, update };
}

// ---------- reel vault ----------
const VKEY = "r2r:vault";
const owner = () => {
  if (!ok()) return "server";
  let o = localStorage.getItem("r2r:owner");
  if (!o) { o = "o_" + Math.random().toString(36).slice(2, 10); localStorage.setItem("r2r:owner", o); }
  return o;
};

export async function listReels(): Promise<SavedReel[]> {
  const local: SavedReel[] = ok() ? JSON.parse(localStorage.getItem(VKEY) || "[]") : [];
  const sb = getSupabase();
  if (!sb) return local.sort((a, b) => b.savedAt - a.savedAt);
  const { data } = await sb.from("reels").select("data").eq("owner", owner()).order("saved_at", { ascending: false });
  return data ? data.map((r) => r.data as SavedReel) : local;
}
export async function saveReel(r: SavedReel): Promise<void> {
  const list: SavedReel[] = ok() ? JSON.parse(localStorage.getItem(VKEY) || "[]") : [];
  localStorage.setItem(VKEY, JSON.stringify([r, ...list.filter((x) => x.id !== r.id)].slice(0, 100)));
  const sb = getSupabase();
  if (sb) await sb.from("reels").upsert({ id: r.id, owner: owner(), data: r, saved_at: new Date(r.savedAt).toISOString() });
}
export async function deleteReel(id: string): Promise<void> {
  const list: SavedReel[] = ok() ? JSON.parse(localStorage.getItem(VKEY) || "[]") : [];
  localStorage.setItem(VKEY, JSON.stringify(list.filter((x) => x.id !== id)));
  const sb = getSupabase();
  if (sb) await sb.from("reels").delete().eq("id", id).eq("owner", owner());
}
