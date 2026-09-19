# Reel2Real

A concept prototype of an add-on inside MakeMyTrip that turns a travel reel into a shared group trip: plan, map and route, weather and packing, expenses with UPI settlement, alternatives when plans break, and booking hand-off.

It runs with **zero API keys** (demo mode, Meghalaya / Goa / Manali & Kasol / Kerala catalog). Add keys to unlock more.

## Run locally
```bash
npm install
cp .env.example .env.local   # optional
npm run dev                  # http://localhost:3000
```
Open **/trip/demo** to see every feature with sample data.

## Deploy
1. Push this folder to GitHub.
2. Vercel -> Add New Project -> import the repo -> Deploy (framework auto-detected: Next.js).
3. Project Settings -> Environment Variables: add any keys below, then redeploy.

## Feature map
| Your idea | Where it lives |
|---|---|
| Paste / share a reel link, research it, get an itinerary + chatbot to change it | `/` (ReelInput) -> `/api/analyze` -> `lib/analyze.ts`; Copilot: `components/Copilot.tsx`, `/api/chat`, `lib/copilot.ts` |
| Optimise the chatbot to give alternatives | Copilot (closed / rain / budget swaps) and the "Something's wrong" button on every stop: `lib/itinerary.ts` `alternativesFor` |
| Trip planner with maps, itineraries, locations | Plan tab, Map tab (`MapView.tsx`, Leaflet + OpenStreetMap) |
| Map + route optimiser + Google Maps link | Map tab, "Optimise route" (nearest-neighbour + 2-opt, `lib/geo.ts`), Google Maps deep links (no key needed) |
| Recent pictures and reviews | Place details: Google Places photos/reviews when `GOOGLE_PLACES_API_KEY` is set; Wikipedia photo + Instagram/YouTube recent-post links otherwise |
| Weather + packing recommendations | Weather tab: Open-Meteo (no key), rule-based packing with a "leave at home" list |
| Alternatives if a place is missed or trip is disrupted | Plan B on every stop, seasonal alerts, late-day warnings |
| Group inside the app, everyone sees plan + expenses | Trip code + WhatsApp invite; live sync with Supabase (`lib/store.ts`, `lib/merge.ts`) |
| Budget, expense splitter, settlement (UPI + other modes) | Money tab: equal/unequal splits, minimum-transfer settle-up, UPI deep link + QR, cash/card/netbanking marking |
| Self-drive, long-duration rental with driver, bus | Book tab (`lib/transport.ts`); self-drive is a partner hand-off |
| Reel repository | `/vault` |
| Bridges existing apps | MakeMyTrip links, Google Maps, UPI apps, WhatsApp, Instagram/YouTube, Google Places, Open-Meteo |

## Environment variables (all optional)
| Variable | What it enables |
|---|---|
| `LLM_API_KEY` (+ `LLM_BASE_URL`, `LLM_MODEL`) | AI place extraction for **any** destination, LLM-powered Copilot. Default is Groq (`llama-3.3-70b-versatile`); any OpenAI-compatible API works |
| `LLM_WHISPER_MODEL` | Transcribing a short uploaded clip (<= 4 MB, Vercel body limit) |
| `GOOGLE_PLACES_API_KEY` | Live open/closed status, ratings, recent reviews, traveller photos, better geocoding. Enable "Places API (New)". Follow Google's attribution rules when displaying |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cross-device shared trips and cloud reel vault. Run `supabase/schema.sql` first |

## Honest limits
- Instagram does not allow apps to fetch reel video. This prototype reads the caption/comments you paste, an uploaded short clip (transcribed), and public oEmbed metadata when available. In production, use a share-sheet/DM entry point and a backend worker with creator consent.
- Catalog coordinates and all costs/fares are approximate and indicative.
- Supabase policies are open for the prototype; use real auth (MMT login) in production.
- Weather beyond 16 days shows the same dates last year as "typical".
- Sample reels are captions written for this demo, not scraped.

## Structure
```
app/            pages + API routes (analyze, chat, weather, place-intel, place-photo, route, geocode, transcribe)
components/     Plan, Map, Money, Weather, Book tabs, Copilot, modals
lib/            catalog, geo/route optimiser, itinerary edits, settlement, packing, copilot, store (local + Supabase), merge
supabase/       schema.sql
```
