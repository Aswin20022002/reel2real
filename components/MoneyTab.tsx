"use client";
import { Check, Plus, QrCode, Smartphone, Trash2, Undo2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useMemo, useState } from "react";
import { estimate, fmtDate, inr, uid } from "@/lib/itinerary";
import { balances, EXP_CATS, liveExpenses, liveSettlements, memberName, owedBy, paidBy, PAY_MODES, settlementPlan, splitAmount, totalSpent, totalsByCategory, Transfer, upiLink } from "@/lib/settle";
import type { ExpCat, PayMode, Trip } from "@/lib/types";
import { Avatar, Empty } from "./ui";

export default function MoneyTab({ trip, update, meId }: { trip: Trip; update: (fn: (t: Trip) => Trip) => void; meId: string }) {
  const est = useMemo(() => estimate(trip), [trip]);
  const spent = totalSpent(trip);
  const net = balances(trip);
  const plan = settlementPlan(trip);
  const cats = totalsByCategory(trip);
  const paid = paidBy(trip);
  const owed = owedBy(trip);
  const me = trip.members.find((m) => m.id === meId) ?? trip.members[0];

  // add-expense form
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [payer, setPayer] = useState(me?.id ?? "");
  const [cat, setCat] = useState<ExpCat>("food");
  const [mode, setMode] = useState<PayMode>("UPI");
  const [day, setDay] = useState<number>(-1);
  const [among, setAmong] = useState<string[]>(trip.members.map((m) => m.id));
  const [custom, setCustom] = useState(false);
  const [shares, setShares] = useState<Record<string, string>>({});
  const [qrFor, setQrFor] = useState<string | null>(null);
  const [payMode, setPayMode] = useState<Record<string, PayMode>>({});

  const amt = parseFloat(amount);
  const canAdd = title.trim() && amt > 0 && among.length > 0 && payer;

  function addExpense() {
    if (!canAdd) return;
    const w: Record<string, number> = {};
    among.forEach((id) => (w[id] = custom ? Math.max(0, parseFloat(shares[id] ?? "1") || 0) : 1));
    const split = splitAmount(amt, among, w);
    update((t) => ({ ...t, expenses: [{ id: uid("e"), title: title.trim(), amount: amt, payerId: payer, split, category: cat, mode, dayIndex: day >= 0 ? day : undefined, date: new Date().toISOString().slice(0, 10), updatedAt: Date.now() }, ...t.expenses] }));
    setTitle(""); setAmount(""); setShares({});
  }
  const toggle = (id: string) => setAmong((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  function settle(tr: Transfer, m: PayMode) {
    update((t) => ({ ...t, settlements: [{ id: uid("s"), fromId: tr.fromId, toId: tr.toId, amount: tr.amount, mode: m, updatedAt: Date.now() }, ...t.settlements] }));
  }
  const undoSettle = (id: string) => update((t) => ({ ...t, settlements: t.settlements.map((s) => (s.id === id ? { ...s, deleted: true, updatedAt: Date.now() } : s)) }));
  const delExp = (id: string) => update((t) => ({ ...t, expenses: t.expenses.map((e) => (e.id === id ? { ...e, deleted: true, updatedAt: Date.now() } : e)) }));
  const setUpi = (id: string, upi: string) => update((t) => ({ ...t, members: t.members.map((m) => (m.id === id ? { ...m, upi, updatedAt: Date.now() } : m)) }));

  const pct = trip.budgetINR ? Math.min(100, (spent / trip.budgetINR) * 100) : 0;
  const maxCat = Math.max(1, ...Object.values(cats));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Budget and expenses</h2>
        <p className="text-sm text-ink-500">Every traveller sees the same numbers. Add what you paid, choose who shares it, and settle by UPI or any other mode.</p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card p-4 md:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-ink-500">Spent so far</div>
              <div className="font-display text-3xl font-extrabold">{inr(spent)}</div>
            </div>
            <label className="text-sm"><span className="label">Group budget (₹)</span>
              <input type="number" min={0} className="input w-36" value={trip.budgetINR || ""} onChange={(e) => update((t) => ({ ...t, budgetINR: Number(e.target.value) || 0, updatedAt: Date.now() }))} /></label>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Budget used">
            <div className={`h-full ${pct > 90 ? "bg-signal" : "bg-lagoon"}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-xs text-ink-500"><span>{Math.round(pct)}% of budget</span><span>{trip.budgetINR ? `${inr(Math.max(0, trip.budgetINR - spent))} left` : "Set a budget to track it"}</span></div>
          <div className="mt-4 space-y-1.5">
            {EXP_CATS.map((c) => (
              <div key={c.key} className="grid grid-cols-[90px_1fr_80px] items-center gap-2 text-sm">
                <span className="text-ink-500">{c.label}</span>
                <div className="h-2 rounded-full bg-ink-100"><div className="h-full rounded-full bg-sky" style={{ width: `${(cats[c.key] / maxCat) * 100}%` }} /></div>
                <span className="text-right font-semibold">{inr(cats[c.key])}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold text-ink-500">Planned per person (indicative)</div>
          <div className="font-display text-3xl font-extrabold">{inr(est.total)}</div>
          <dl className="mt-3 space-y-1 text-sm">
            {[["Stay", est.stay], ["Food", est.food], ["Local cab share", est.localTransport], ["Entry and activities", est.activities]].map(([k, v]) => (
              <div key={k as string} className="flex justify-between"><dt className="text-ink-500">{k}</dt><dd className="font-semibold">{inr(v as number)}</dd></div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-ink-500">Excludes getting to the destination. Group total {inr(est.groupTotal)}.</p>
        </div>
      </section>

      <section className="card p-4">
        <h3 className="font-display text-lg font-bold">Who owes what</h3>
        <div className="mt-2 divide-y divide-ink-100">
          {trip.members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2.5">
              <Avatar m={m} />
              <div className="min-w-0 flex-1"><div className="font-semibold">{m.name}{m.id === meId ? " (you)" : ""}</div><div className="text-xs text-ink-500">Paid {inr(paid[m.id] ?? 0)} · share {inr(owed[m.id] ?? 0)}</div></div>
              <div className={`text-right font-display text-lg font-bold ${net[m.id] > 1 ? "text-lagoon-700" : net[m.id] < -1 ? "text-signal" : "text-ink-500"}`}>
                {net[m.id] > 1 ? `gets ${inr(net[m.id] / 100)}` : net[m.id] < -1 ? `owes ${inr(-net[m.id] / 100)}` : "settled"}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-4">
        <h3 className="font-display text-lg font-bold">Settle up</h3>
        {plan.length === 0 ? <p className="mt-2 text-sm text-ink-500">Nothing to settle right now.</p> : (
          <ul className="mt-3 space-y-3">
            {plan.map((tr) => {
              const to = trip.members.find((m) => m.id === tr.toId)!;
              const from = trip.members.find((m) => m.id === tr.fromId)!;
              const key = tr.fromId + tr.toId;
              const link = upiLink(to, tr.amount, `${trip.name} settle-up`);
              return (
                <li key={key} className="perf rounded-xl border border-dashed border-ink-200 bg-ink-50/50 p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Avatar m={from} /> <span className="font-semibold">{from.name}</span> <span className="text-ink-500">pays</span> <Avatar m={to} /> <span className="font-semibold">{to.name}</span>
                    <span className="ml-auto font-display text-xl font-extrabold">{inr(tr.amount)}</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {link ? (
                      <>
                        <a className="btn-primary btn-sm" href={link}><Smartphone size={14} /> Pay with UPI app</a>
                        <button className="btn-ghost btn-sm" onClick={() => setQrFor(qrFor === key ? null : key)}><QrCode size={14} /> QR for {to.name.split(" ")[0]}</button>
                      </>
                    ) : <span className="text-xs text-ink-500">{to.name} hasn't added a UPI ID yet. Pay by another mode or ask them to add one below.</span>}
                    <select className="input ml-auto w-32 py-1 text-xs" aria-label="Payment mode" value={payMode[key] ?? "UPI"} onChange={(e) => setPayMode((p) => ({ ...p, [key]: e.target.value as PayMode }))}>{PAY_MODES.map((m) => <option key={m}>{m}</option>)}</select>
                    <button className="btn-dark btn-sm" onClick={() => settle(tr, payMode[key] ?? "UPI")}><Check size={14} /> Mark as paid</button>
                  </div>
                  {qrFor === key && link && (
                    <div className="mt-3 flex items-center gap-4 rounded-lg bg-white p-3">
                      <QRCodeSVG value={link} size={128} />
                      <p className="text-xs text-ink-500">Scan with any UPI app to pay {to.name} {inr(tr.amount)}. Amount and note are pre-filled. Then tap "Mark as paid" so everyone sees it.</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {liveSettlements(trip).length > 0 && (
          <div className="mt-4 border-t border-dashed border-ink-200 pt-3">
            <div className="text-xs font-semibold text-ink-500">Already settled</div>
            <ul className="mt-1 space-y-1 text-sm">{liveSettlements(trip).map((s) => (
              <li key={s.id} className="flex items-center justify-between"><span>{memberName(trip, s.fromId)} paid {memberName(trip, s.toId)} {inr(s.amount)} via {s.mode}</span><button className="btn-ghost btn-sm" onClick={() => undoSettle(s.id)} aria-label="Undo settlement"><Undo2 size={12} /></button></li>
            ))}</ul>
          </div>
        )}
      </section>

      <section className="card p-4">
        <h3 className="font-display text-lg font-bold">Add an expense</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2"><label className="label" htmlFor="et">What was it for?</label><input id="et" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dinner at Police Bazar" /></div>
          <div><label className="label" htmlFor="ea">Amount (₹)</label><input id="ea" type="number" min={0} className="input" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div><label className="label" htmlFor="ep">Paid by</label><select id="ep" className="input" value={payer} onChange={(e) => setPayer(e.target.value)}>{trip.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
          <div><label className="label" htmlFor="ec">Category</label><select id="ec" className="input" value={cat} onChange={(e) => setCat(e.target.value as ExpCat)}>{EXP_CATS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></div>
          <div><label className="label" htmlFor="em">Paid using</label><select id="em" className="input" value={mode} onChange={(e) => setMode(e.target.value as PayMode)}>{PAY_MODES.map((m) => <option key={m}>{m}</option>)}</select></div>
          <div><label className="label" htmlFor="ed">Day</label><select id="ed" className="input" value={day} onChange={(e) => setDay(Number(e.target.value))}><option value={-1}>Not tied to a day</option>{trip.days.map((_, i) => <option key={i} value={i}>Day {i + 1}</option>)}</select></div>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between"><span className="label mb-0">Split between</span>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-500"><input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} /> Unequal shares</label></div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {trip.members.map((m) => (
              <div key={m.id} className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-sm ${among.includes(m.id) ? "border-sky bg-sky-50" : "border-ink-200 bg-white text-ink-500"}`}>
                <button type="button" className="flex items-center gap-1.5" onClick={() => toggle(m.id)} aria-pressed={among.includes(m.id)}><Avatar m={m} size={20} />{m.name}</button>
                {custom && among.includes(m.id) && <input type="number" min={0} step="0.5" aria-label={`Share for ${m.name}`} className="w-14 rounded border border-ink-200 px-1 py-0.5 text-xs" value={shares[m.id] ?? "1"} onChange={(e) => setShares((s) => ({ ...s, [m.id]: e.target.value }))} />}
              </div>
            ))}
          </div>
          {canAdd && <p className="mt-2 text-xs text-ink-500">{custom ? "Shares are relative weights (2 pays double 1)." : `${inr(amt / among.length)} each across ${among.length} ${among.length === 1 ? "person" : "people"}.`}</p>}
        </div>
        <button className="btn-primary mt-3" disabled={!canAdd} onClick={addExpense}><Plus size={16} /> Add expense</button>
      </section>

      <section>
        <h3 className="mb-2 font-display text-lg font-bold">All expenses</h3>
        {liveExpenses(trip).length === 0 ? <Empty title="No expenses yet">Add the first one above. Everyone in the trip will see it instantly.</Empty> : (
          <ul className="space-y-2">
            {liveExpenses(trip).map((e) => (
              <li key={e.id} className="card flex items-center gap-3 p-3">
                <Avatar m={trip.members.find((m) => m.id === e.payerId) ?? { name: "?", color: "#999" }} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{e.title}</div>
                  <div className="text-xs text-ink-500">{memberName(trip, e.payerId)} paid via {e.mode} · split {Object.keys(e.split).length} ways · {EXP_CATS.find((c) => c.key === e.category)?.label}{e.dayIndex !== undefined ? ` · Day ${e.dayIndex + 1}` : ""} · {fmtDate(e.date)}</div>
                </div>
                <div className="font-display text-lg font-bold">{inr(e.amount)}</div>
                <button className="btn-ghost btn-sm" onClick={() => delExp(e.id)} aria-label={`Delete ${e.title}`}><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4">
        <h3 className="font-display text-lg font-bold">UPI IDs for settling</h3>
        <p className="text-sm text-ink-500">Each traveller adds their own UPI ID so friends can pay them in one tap.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {trip.members.map((m) => (
            <div key={m.id} className="flex items-center gap-2"><Avatar m={m} size={24} /><span className="w-20 truncate text-sm font-semibold">{m.name}</span>
              <input className="input py-1.5" placeholder="name@bank" value={m.upi ?? ""} disabled={m.id !== meId} onChange={(e) => setUpi(m.id, e.target.value.trim())} aria-label={`UPI ID for ${m.name}`} /></div>
          ))}
        </div>
      </section>
    </div>
  );
}
