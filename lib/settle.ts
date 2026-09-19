import type { ExpCat, Expense, Member, PayMode, Settlement, Trip } from "./types";

export const EXP_CATS: { key: ExpCat; label: string }[] = [
  { key: "stay", label: "Stay" },
  { key: "food", label: "Food" },
  { key: "transport", label: "Transport" },
  { key: "activity", label: "Activities" },
  { key: "shopping", label: "Shopping" },
  { key: "other", label: "Other" },
];
export const PAY_MODES: PayMode[] = ["UPI", "Cash", "Card", "Netbanking", "Wallet"];

const toPaise = (n: number) => Math.round(n * 100);
const fromPaise = (p: number) => p / 100;

/** Split an amount across members. `shares` is an optional relative weight per member (default equal). */
export function splitAmount(amount: number, memberIds: string[], shares?: Record<string, number>): Record<string, number> {
  const total = toPaise(amount);
  const ids = memberIds.length ? memberIds : [];
  const weights = ids.map((id) => Math.max(0, shares?.[id] ?? 1));
  const wSum = weights.reduce((a, b) => a + b, 0) || ids.length || 1;
  const out: Record<string, number> = {};
  let assigned = 0;
  ids.forEach((id, i) => {
    const part = i === ids.length - 1 ? total - assigned : Math.floor((total * weights[i]) / wSum);
    out[id] = fromPaise(part);
    assigned += part;
  });
  return out;
}

export const liveExpenses = (t: Trip) => t.expenses.filter((e) => !e.deleted);
export const liveSettlements = (t: Trip) => t.settlements.filter((s) => !s.deleted);

/** Net balance per member in paise: positive = is owed money, negative = owes money. */
export function balances(t: Trip): Record<string, number> {
  const net: Record<string, number> = {};
  t.members.forEach((m) => (net[m.id] = 0));
  for (const e of liveExpenses(t)) {
    net[e.payerId] = (net[e.payerId] ?? 0) + toPaise(e.amount);
    for (const [id, amt] of Object.entries(e.split)) net[id] = (net[id] ?? 0) - toPaise(amt);
  }
  for (const s of liveSettlements(t)) {
    net[s.fromId] = (net[s.fromId] ?? 0) + toPaise(s.amount);
    net[s.toId] = (net[s.toId] ?? 0) - toPaise(s.amount);
  }
  return net;
}

export interface Transfer { fromId: string; toId: string; amount: number }

/** Greedy minimal-transfer settlement plan. */
export function settlementPlan(t: Trip): Transfer[] {
  const net = balances(t);
  const debtors = Object.entries(net).filter(([, v]) => v < -1).map(([id, v]) => ({ id, v: -v })).sort((a, b) => b.v - a.v);
  const creditors = Object.entries(net).filter(([, v]) => v > 1).map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v);
  const out: Transfer[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].v, creditors[j].v);
    if (amt > 0) out.push({ fromId: debtors[i].id, toId: creditors[j].id, amount: fromPaise(amt) });
    debtors[i].v -= amt; creditors[j].v -= amt;
    if (debtors[i].v <= 1) i++;
    if (creditors[j].v <= 1) j++;
  }
  return out;
}

export function totalsByCategory(t: Trip): Record<ExpCat, number> {
  const out: Record<ExpCat, number> = { stay: 0, food: 0, transport: 0, activity: 0, shopping: 0, other: 0 };
  liveExpenses(t).forEach((e) => (out[e.category] += e.amount));
  return out;
}
export const totalSpent = (t: Trip) => liveExpenses(t).reduce((s, e) => s + e.amount, 0);

export function paidBy(t: Trip): Record<string, number> {
  const out: Record<string, number> = {};
  t.members.forEach((m) => (out[m.id] = 0));
  liveExpenses(t).forEach((e) => (out[e.payerId] = (out[e.payerId] ?? 0) + e.amount));
  return out;
}
export function owedBy(t: Trip): Record<string, number> {
  const out: Record<string, number> = {};
  t.members.forEach((m) => (out[m.id] = 0));
  liveExpenses(t).forEach((e) => Object.entries(e.split).forEach(([id, a]) => (out[id] = (out[id] ?? 0) + a)));
  return out;
}

export function upiLink(m: Member, amount: number, note: string): string | undefined {
  if (!m.upi) return undefined;
  const q = new URLSearchParams({ pa: m.upi, pn: m.name, am: amount.toFixed(2), cu: "INR", tn: note });
  return `upi://pay?${q.toString()}`;
}

export const memberName = (t: Trip, id: string) => t.members.find((m) => m.id === id)?.name ?? "Someone";

export type { Expense, Settlement };
