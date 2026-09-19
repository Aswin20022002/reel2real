import Link from "next/link";

const FRICTION = [
  ["Reels get saved and forgotten", "Reel vault keeps every saved video with the trip it became, so intent isn't lost inside Instagram.", "Capture"],
  ["Reels rarely name every place, and none say how to connect them", "Places are extracted from the caption or voice-over, placed on a map, grouped into days and ordered by driving distance with times.", "Convert"],
  ["Research happens in ten tabs", "Photos, reviews, seasonal warnings, weather and packing sit on each stop, so the plan is checked in one place.", "Convert"],
  ["Friends coordinate in WhatsApp and nothing sticks", "One trip code. Everyone sees the same itinerary, budget, bookings and who owes what.", "Commit"],
  ["Money gets awkward", "Expenses split equally or by share, with minimum-transfer settle-up and UPI links and QR codes.", "Commit"],
  ["Plans break on the road", "Every stop has a Plan B. One tap handles closed, rain, too far or over budget. Late days are flagged before they happen.", "Continue"],
  ["The trip and the booking live in different apps", "Getting there, stays and cabs link to MakeMyTrip with the trip's dates and group size in mind, and confirmed bookings flow into shared expenses.", "Continue"],
];

export default function About() {
  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="font-display text-3xl font-extrabold">Why this works for MakeMyTrip</h1>
        <p className="mt-2 text-lg text-ink-700">The case asks how MakeMyTrip can turn the moment of inspiration into a real trip. This prototype shows one answer: meet travellers when they are watching a reel, and keep the whole group in one plan until the trip is booked and paid for.</p>
      </header>

      <section>
        <h2 className="font-display text-xl font-bold">Friction it removes</h2>
        <ul className="mt-3 space-y-3">
          {FRICTION.map(([p, s, stage]) => (
            <li key={p} className="card p-4"><div className="flex items-start justify-between gap-3"><div className="font-semibold">{p}</div><span className="chip shrink-0 bg-sky-50 text-sky-700">{stage}</span></div><p className="mt-1 text-sm text-ink-700">{s}</p></li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold">What already exists, and the gaps</h2>
        <ul className="mt-3 list-inside list-disc space-y-2 text-ink-700">
          <li>Expedia Trip Matching turns reels sent over Instagram into itineraries, but it is a US pilot and stays inside Expedia's inventory.</li>
          <li>Mindtrip builds plans from videos, articles and photos, supports group voting, and has added in-chat flight booking through a partner. Its inventory is not Indian trains, buses and outstation cabs.</li>
          <li>Wanderlog is strong on collaboration, route optimisation and expense splitting. It works as a planner, and settlement happens outside it.</li>
          <li>Small reel-to-itinerary apps exist, so extraction alone is not a moat.</li>
          <li>In the team's own test, Myra did not return places or a plan when given a video.</li>
        </ul>
        <p className="mt-3 rounded-xl bg-sky-50 p-4 text-sm text-sky-700">The gap Reel2Real targets: reel to plan to group commitment to Indian booking supply and UPI settlement, in one flow. That sequence is hard for a pure planner to copy, and it is what MakeMyTrip already runs.</p>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold">Why MakeMyTrip can own it</h2>
        <ul className="mt-3 list-inside list-disc space-y-2 text-ink-700">
          <li><b>Supply and payments.</b> Flights, trains, buses, cabs, stays and holidays under one login, with UPI already normal for Indian travellers.</li>
          <li><b>Earlier intent.</b> A vault of saved reels shows where someone wants to go before they search, so MakeMyTrip can meet demand months earlier.</li>
          <li><b>Group data.</b> A trip with four people and a shared budget is a bigger and stickier booking than a solo search.</li>
          <li><b>Local trust.</b> Regional-language support, Indian seasons and road realities are built into the plan instead of bolted on.</li>
        </ul>
        <p className="mt-3 text-sm text-ink-500">Metrics to track: reel-to-trip rate, trip-to-booking rate, average group size, expenses logged per trip, and repeat trips.</p>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold">What is real in this prototype and what is not</h2>
        <ul className="mt-3 list-inside list-disc space-y-2 text-ink-700">
          <li><b>Real:</b> route ordering and day grouping, Google Maps deep links, road geometry (OSRM), weather (Open-Meteo), packing rules, expense splitting and settlement, UPI links and QR codes, trip sharing (with Supabase), Google Places status and reviews (with a key).</li>
          <li><b>Needs a key:</b> AI extraction for any destination, Copilot on an LLM, audio transcription, live Google Places data, cross-device groups.</li>
          <li><b>Not possible from a web app:</b> reading Instagram video directly. The production path is a share-sheet or DM entry point with a backend that fetches audio and captions with the creator's consent.</li>
          <li><b>Indicative only:</b> costs, fares and durations. Live prices come from MakeMyTrip at booking time.</li>
        </ul>
      </section>

      <div className="flex gap-2"><Link className="btn-primary" href="/">Try it with a reel</Link><Link className="btn-ghost" href="/trip/demo">Open the demo trip</Link></div>
    </article>
  );
}
