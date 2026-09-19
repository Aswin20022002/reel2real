"use client";
import { BedDouble, Camera, Footprints, Landmark, ShoppingBag, Sparkles, TreePine, Utensils, X } from "lucide-react";
import type { ReactNode } from "react";
import type { Category, Member } from "@/lib/types";

export const CAT: Record<Category, { label: string; color: string; bg: string; Icon: typeof Camera }> = {
  sight: { label: "Sight", color: "#0A4FBD", bg: "#eaf2ff", Icon: Camera },
  nature: { label: "Nature", color: "#0a7266", bg: "#e3f6f3", Icon: TreePine },
  food: { label: "Food", color: "#a76a00", bg: "#fff4dd", Icon: Utensils },
  adventure: { label: "Adventure", color: "#b3211d", bg: "#fdecec", Icon: Footprints },
  culture: { label: "Culture", color: "#6d28d9", bg: "#f1eafe", Icon: Landmark },
  stay: { label: "Stay", color: "#24384f", bg: "#e4eaf2", Icon: BedDouble },
  shopping: { label: "Shopping", color: "#be185d", bg: "#fdeaf3", Icon: ShoppingBag },
  wellness: { label: "Wellness", color: "#0891b2", bg: "#e0f7fb", Icon: Sparkles },
};

export function CatChip({ c }: { c: Category }) {
  const m = CAT[c];
  return (
    <span className="chip" style={{ background: m.bg, color: m.color }}>
      <m.Icon size={12} aria-hidden /> {m.label}
    </span>
  );
}

export function Avatar({ m, size = 28 }: { m: Pick<Member, "name" | "color">; size?: number }) {
  return (
    <span
      title={m.name}
      className="inline-flex items-center justify-center rounded-full font-bold text-white ring-2 ring-white"
      style={{ width: size, height: size, background: m.color, fontSize: size * 0.42 }}
    >
      {m.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function AvatarStack({ members, max = 5 }: { members: Member[]; max?: number }) {
  return (
    <span className="inline-flex -space-x-2">
      {members.slice(0, max).map((m) => <Avatar key={m.id} m={m} />)}
      {members.length > max && <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold ring-2 ring-white">+{members.length - max}</span>}
    </span>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className={`max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <button className="rounded-md p-1 text-ink-500 hover:bg-ink-50" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 p-8 text-center">
      <p className="font-display text-lg font-bold">{title}</p>
      {children && <div className="mt-1 text-sm text-ink-500">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-ink-500">{label}</div>
      <div className="font-display text-xl font-bold leading-tight">{value}</div>
      {sub && <div className="text-xs text-ink-500">{sub}</div>}
    </div>
  );
}
