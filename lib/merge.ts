import type { Trip } from "./types";

interface Stamped { id: string; updatedAt: number }

function mergeById<T extends Stamped>(a: T[] = [], b: T[] = []): T[] {
  const m = new Map<string, T>();
  [...a, ...b].forEach((x) => {
    const cur = m.get(x.id);
    if (!cur || (x.updatedAt ?? 0) >= (cur.updatedAt ?? 0)) m.set(x.id, x);
  });
  return [...m.values()];
}

/**
 * Conflict-tolerant merge used by the Supabase backend so two friends adding expenses at the same time never overwrite each other.
 * - members / expenses / settlements / bookings: union by id, newest edit wins (deletes are tombstones)
 * - itinerary (days + places + pace): whichever side edited it last wins
 * - trip fields (name, budget...): whichever side updated last wins
 */
export function mergeTrips(remote: Trip, local: Trip): Trip {
  const newer = local.updatedAt >= remote.updatedAt ? local : remote;
  const itin = local.itinUpdatedAt >= remote.itinUpdatedAt ? local : remote;
  return {
    ...newer,
    days: itin.days,
    places: itin.places,
    pace: itin.pace,
    itinUpdatedAt: Math.max(local.itinUpdatedAt, remote.itinUpdatedAt),
    members: mergeById(remote.members, local.members),
    expenses: mergeById(remote.expenses, local.expenses),
    settlements: mergeById(remote.settlements, local.settlements),
    bookings: mergeById(remote.bookings, local.bookings),
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  };
}
