// One-shot seed: pushes the contents of src/data/mockData.ts into Supabase.
//
// Run with:  npm run seed
//
// Uses the SECRET key (service_role) so it bypasses RLS — that's why this
// script lives outside src/ and only ever runs locally. NEVER ship this
// path into production code or the frontend bundle.

import { createClient } from "@supabase/supabase-js";
import { mockGuests, mockVideos } from "../src/data/mockData";

const url = process.env.VITE_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  console.error(
    "Missing env. Make sure .env.local has both VITE_SUPABASE_URL and " +
      "SUPABASE_SECRET_KEY set.",
  );
  process.exit(1);
}

const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log(`→ Seeding ${mockGuests.length} guests…`);
  const { error: gErr } = await supabase.from("guests").upsert(
    mockGuests.map((g) => ({
      id: g.id,
      name: g.name,
    })),
  );
  if (gErr) throw gErr;

  console.log(`→ Seeding ${mockVideos.length} videos…`);
  const { error: vErr } = await supabase.from("videos").upsert(
    mockVideos.map((v) => ({
      id: v.id,
      title: v.title,
      bilibili_url: v.bilibiliUrl,
      published_at: v.publishedAt,
      duration_sec: v.durationSec ?? null,
    })),
  );
  if (vErr) throw vErr;

  // Wipe and re-insert the join table to keep it in sync with mockData,
  // even if guest assignments change between seed runs.
  console.log("→ Refreshing video_guests join table…");
  const videoIds = mockVideos.map((v) => v.id);
  const { error: dErr } = await supabase
    .from("video_guests")
    .delete()
    .in("video_id", videoIds);
  if (dErr) throw dErr;

  const joinRows = mockVideos.flatMap((v) =>
    v.guestIds.map((gid) => ({ video_id: v.id, guest_id: gid })),
  );
  const { error: jErr } = await supabase.from("video_guests").insert(joinRows);
  if (jErr) throw jErr;

  console.log(
    `✓ Done. ${mockGuests.length} guests, ${mockVideos.length} videos, ${joinRows.length} guest-appearances.`,
  );
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
