export type Category = "sight" | "nature" | "food" | "adventure" | "culture" | "stay" | "shopping" | "wellness";

export interface Season {
  /** months (1-12) when the place is typically closed / restricted / risky */
  closedMonths: number[];
  note: string;
}

export interface Place {
  id: string;
  name: string;
  category: Category;
  area: string;
  lat: number;
  lng: number;
  description: string;
  durationMin: number;
  /** typical per-person spend in INR (entry, activity, meal). Indicative only. */
  costINR: number;
  tags: string[];
  wiki?: string;
  indoor?: boolean;
  fromReel?: boolean;
  /** what the reel / caption said about this place */
  evidence?: string;
  season?: Season;
  source?: "reel" | "catalog" | "ai" | "search" | "copilot";
  /** stays only: indicative cost per night for a room */
  nightINR?: number;
}

export interface Member {
  id: string;
  name: string;
  upi?: string;
  color: string;
  updatedAt: number;
}

export interface Day {
  id: string;
  title: string;
  placeIds: string[];
  startTime: string; // "09:00"
  stayId?: string;
}

export interface ReelSource {
  url: string;
  platform: "instagram" | "youtube" | "tiktok" | "other";
  title?: string;
  author?: string;
  thumbnail?: string;
  caption?: string;
}

export type ExpCat = "stay" | "food" | "transport" | "activity" | "shopping" | "other";
export type PayMode = "UPI" | "Cash" | "Card" | "Netbanking" | "Wallet";

export interface Expense {
  id: string;
  title: string;
  amount: number;
  payerId: string;
  /** memberId -> owed amount (sums to amount) */
  split: Record<string, number>;
  category: ExpCat;
  mode: PayMode;
  dayIndex?: number;
  date: string; // ISO date
  updatedAt: number;
  deleted?: boolean;
}

export interface Settlement {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  mode: PayMode;
  updatedAt: number;
  deleted?: boolean;
}

export type BookingKind = "flight" | "train" | "bus" | "cab" | "selfdrive" | "stay" | "activity";
export interface Booking {
  id: string;
  kind: BookingKind;
  title: string;
  status: "idea" | "shortlisted" | "booked";
  amount?: number;
  ref?: string;
  updatedAt: number;
  deleted?: boolean;
}

export type Pace = "relaxed" | "balanced" | "packed";

export interface Trip {
  id: string;
  name: string;
  destinationKey?: string;
  destination: string;
  origin: string;
  startDate: string; // ISO date
  pace: Pace;
  days: Day[];
  places: Record<string, Place>;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
  bookings: Booking[];
  budgetINR: number;
  reel?: ReelSource;
  createdAt: number;
  updatedAt: number;
  itinUpdatedAt: number;
}

export interface Analysis {
  engine: "ai" | "catalog";
  destinationKey?: string;
  destination: string;
  title: string;
  summary: string;
  vibe: string[];
  suggestedDays?: number;
  places: Place[];
  warnings: string[];
  needsInput?: boolean;
  reel: ReelSource;
}

export interface SavedReel {
  id: string;
  url: string;
  platform: ReelSource["platform"];
  title?: string;
  author?: string;
  thumbnail?: string;
  caption?: string;
  destination?: string;
  placeCount?: number;
  tripId?: string;
  savedAt: number;
}

export type Action =
  | { type: "remove"; placeId: string }
  | { type: "add"; place: Place; dayIndex?: number }
  | { type: "move"; placeId: string; dayIndex: number }
  | { type: "swap"; removeId: string; place: Place }
  | { type: "setPace"; pace: Pace };

export interface CopilotChip {
  label: string;
  action: Action;
}
export interface CopilotReply {
  reply: string;
  chips?: CopilotChip[];
  actions?: Action[];
}

export interface DayWeather {
  date: string;
  tmax: number;
  tmin: number;
  rainMm: number;
  rainProb?: number;
  code: number;
  wind?: number;
  uv?: number;
}
export interface WeatherResult {
  mode: "forecast" | "last-year";
  days: DayWeather[];
}
