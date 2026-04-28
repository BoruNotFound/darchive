// One-time script: fetch all videos for a bilibili creator, download
// thumbnails into our `video-thumbnails` Storage bucket, and insert them
// into the `videos` table.
//
// Runs LOCALLY (residential IP) because bilibili anti-bot bans Supabase's
// data-center IPs. Uses the service_role key so it bypasses RLS.
//
// Run with:  npm run import-videos
//
// Required env vars in .env.local:
//   VITE_SUPABASE_URL
//   SUPABASE_SECRET_KEY

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

// ----- Config (edit if needed) ------------------------------------------

const UID = 208130286;
const SINCE_DATE = "2021-12-09"; // YYYY-MM-DD, inclusive
const PAGE_SIZE = 30;
const PAGE_DELAY_MS = 300; // be polite

// ----- Setup ------------------------------------------------------------

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error(
    "Missing env. Make sure .env.local has VITE_SUPABASE_URL and SUPABASE_SECRET_KEY.",
  );
  process.exit(1);
}

// Your bilibili browser cookie. Without this, bilibili's anti-bot bans the
// request. Copy from DevTools → Network → any bilibili request → Cookie header.
const BILI_COOKIE = (process.env.BILI_COOKIE ?? "").trim();
if (!BILI_COOKIE) {
  console.error(
    "Missing BILI_COOKIE in .env.local. Copy your bilibili Cookie header " +
      "from your browser DevTools (Network tab → any bilibili.com request → " +
      "Request Headers → Cookie) and add it to .env.local as a single line:\n" +
      "  BILI_COOKIE=buvid3=...; SESSDATA=...; bili_jct=...; …",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ----- WBI signing (same as edge function) ------------------------------

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61,
  26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
  20, 34, 44, 52,
];

function md5Hex(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

function getMixinKey(orig: string): string {
  return MIXIN_KEY_ENC_TAB.map((n) => orig[n] ?? "")
    .join("")
    .slice(0, 32);
}

interface WbiKeys {
  imgKey: string;
  subKey: string;
}

async function getWbiKeys(): Promise<WbiKeys> {
  const resp = await fetch("https://api.bilibili.com/x/web-interface/nav", {
    headers: { "User-Agent": BROWSER_UA, "Cookie": BILI_COOKIE },
  });
  if (!resp.ok) throw new Error(`nav HTTP ${resp.status}`);
  const data = (await resp.json()) as {
    data?: { wbi_img?: { img_url?: string; sub_url?: string } };
  };
  const wbi = data?.data?.wbi_img;
  if (!wbi) throw new Error("nav missing wbi_img");
  const imgKey = String(wbi.img_url ?? "").split("/").pop()?.split(".")[0] ?? "";
  const subKey = String(wbi.sub_url ?? "").split("/").pop()?.split(".")[0] ?? "";
  if (imgKey.length !== 32 || subKey.length !== 32) {
    throw new Error(`wbi keys not 32 chars (${imgKey.length}/${subKey.length})`);
  }
  return { imgKey, subKey };
}

function signWbi(
  params: Record<string, string | number>,
  keys: WbiKeys,
): Record<string, string> {
  const mixin = getMixinKey(keys.imgKey + keys.subKey);
  const wts = Math.floor(Date.now() / 1000);
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    cleaned[k] = String(v).replace(/[!'()*]/g, "");
  }
  cleaned.wts = String(wts);
  const sortedKeys = Object.keys(cleaned).sort();
  const query = sortedKeys
    .map((k) => `${k}=${encodeURIComponent(cleaned[k])}`)
    .join("&");
  const w_rid = md5Hex(query + mixin);
  return { ...cleaned, w_rid };
}

// ----- Bilibili API -----------------------------------------------------

interface BiliVideo {
  bvid: string;
  title: string;
  created: number;
  pic: string;
  length: string;
}

async function fetchUserVideoPage(
  uid: number,
  pn: number,
  ps: number,
  keys: WbiKeys,
): Promise<{ vlist: BiliVideo[]; count: number }> {
  const signed = signWbi({ mid: uid, pn, ps, order: "pubdate" }, keys);
  const url =
    "https://api.bilibili.com/x/space/wbi/arc/search?" +
    new URLSearchParams(signed).toString();
  const resp = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      "Referer": `https://space.bilibili.com/${uid}/upload/video`,
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "Cookie": BILI_COOKIE,
    },
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`space api HTTP ${resp.status}: ${body.slice(0, 200)}`);
  }
  const data = (await resp.json()) as {
    code: number;
    message?: string;
    data?: {
      list: { vlist: BiliVideo[] };
      page: { count: number };
    };
  };
  if (data.code !== 0 || !data.data) {
    throw new Error(
      `space api code ${data.code}: ${data.message ?? "unknown"}`,
    );
  }
  return {
    vlist: data.data.list.vlist ?? [],
    count: data.data.page.count ?? 0,
  };
}

async function fetchAllUserVideos(uid: number): Promise<BiliVideo[]> {
  const keys = await getWbiKeys();
  const all: BiliVideo[] = [];
  let pn = 1;
  let totalCount = 0;
  while (pn <= 100) {
    const { vlist, count } = await fetchUserVideoPage(uid, pn, PAGE_SIZE, keys);
    totalCount = count;
    all.push(...vlist);
    if (vlist.length < PAGE_SIZE || all.length >= totalCount) break;
    pn++;
    await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
  }
  return all;
}

function parseLengthSec(s: string | undefined): number | null {
  if (!s) return null;
  const parts = s.split(":").map((x) => parseInt(x, 10));
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

// ----- Storage + DB writes (service_role bypasses RLS) ------------------

async function videoExists(bvid: string): Promise<boolean> {
  const { data } = await supabase
    .from("videos")
    .select("id")
    .eq("id", bvid)
    .maybeSingle();
  return data !== null;
}

async function downloadAndUploadThumbnail(
  bvid: string,
  picUrl: string,
): Promise<string> {
  const resp = await fetch(picUrl, {
    headers: {
      "User-Agent": BROWSER_UA,
      "Referer": "https://www.bilibili.com/",
    },
  });
  if (!resp.ok) throw new Error(`thumbnail HTTP ${resp.status}`);
  const contentType = resp.headers.get("content-type") ?? "image/jpeg";
  const ext =
    contentType.split("/")[1]?.split(";")[0]?.toLowerCase() ?? "jpg";
  const buf = Buffer.from(await resp.arrayBuffer());
  const path = `${bvid}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("video-thumbnails")
    .upload(path, buf, { contentType, upsert: false });
  if (error) throw new Error(`storage upload: ${error.message}`);
  const { data } = supabase.storage
    .from("video-thumbnails")
    .getPublicUrl(path);
  return data.publicUrl;
}

async function insertVideo(v: BiliVideo, thumbnailUrl: string): Promise<void> {
  const publishedAt = new Date(v.created * 1000)
    .toISOString()
    .split("T")[0];
  const { error } = await supabase.from("videos").insert({
    id: v.bvid,
    title: v.title,
    bilibili_url: `https://www.bilibili.com/video/${v.bvid}`,
    published_at: publishedAt,
    duration_sec: parseLengthSec(v.length),
    thumbnail_url: thumbnailUrl,
  });
  if (error) throw new Error(`db insert: ${error.message}`);
}

// ----- Main -------------------------------------------------------------

async function main() {
  console.log(`Fetching video list for UID ${UID}…`);
  const all = await fetchAllUserVideos(UID);
  console.log(`Got ${all.length} videos total.`);

  const filtered = all.filter((v) => {
    const d = new Date(v.created * 1000).toISOString().split("T")[0];
    return d >= SINCE_DATE;
  });
  console.log(`${filtered.length} videos on or after ${SINCE_DATE}.`);

  let inserted = 0;
  let skipped = 0;
  const errors: { bvid: string; title: string; msg: string }[] = [];

  for (let i = 0; i < filtered.length; i++) {
    const v = filtered[i];
    const tag = `[${i + 1}/${filtered.length}] ${v.bvid}`;
    try {
      if (await videoExists(v.bvid)) {
        skipped++;
        process.stdout.write(`${tag}  skip (already exists)\n`);
        continue;
      }
      process.stdout.write(`${tag}  ${v.title.slice(0, 40)}…\n`);
      const thumbnailUrl = await downloadAndUploadThumbnail(v.bvid, v.pic);
      await insertVideo(v, thumbnailUrl);
      inserted++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ bvid: v.bvid, title: v.title, msg });
      console.error(`${tag}  FAIL: ${msg}`);
    }
  }

  console.log("");
  console.log(`Done.`);
  console.log(`  inserted: ${inserted}`);
  console.log(`  skipped:  ${skipped}`);
  console.log(`  errors:   ${errors.length}`);
  if (errors.length > 0) {
    console.log("");
    console.log("Failures:");
    for (const e of errors) {
      console.log(`  ${e.bvid}  ${e.title}\n    ${e.msg}`);
    }
  }
}

main().catch((e) => {
  console.error("Script failed:", e);
  process.exit(1);
});
