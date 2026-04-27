// Supabase Edge Function — fetch-bilibili-metadata
//
// Takes a bilibili video URL, calls bilibili's public metadata API
// server-side (the browser can't call it directly because of CORS), then
// downloads the thumbnail and re-uploads it to our `video-thumbnails`
// Storage bucket so we own the asset.
//
// Returns: { bvid, title, durationSec, publishedAt, thumbnailUrl }
//
// Auth: caller must have an admin session — we re-validate via the same
// is_admin() RPC the rest of the app uses.
//
// Deploy via Dashboard → Edge Functions → New (or `supabase functions deploy`).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface BilibiliApiResponse {
  code: number;
  message?: string;
  data?: {
    bvid: string;
    title: string;
    pic: string;
    duration: number;
    pubdate: number;
    desc?: string;
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

// deno-lint-ignore no-explicit-any
declare const Deno: any;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  try {
    const { videoUrl } = await req.json();
    if (!videoUrl || typeof videoUrl !== "string") {
      return jsonError("Missing videoUrl", 400);
    }

    // Extract BV id from any bilibili url shape (avid-format BVxxxxxxxxxx).
    const match = videoUrl.match(/BV[a-zA-Z0-9]+/);
    if (!match) return jsonError("Could not find a BV id in the URL", 400);
    const bvid = match[0];

    // ---- Auth: verify caller is an admin ---------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonError("Unauthorized", 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: isAdmin, error: rpcErr } = await userClient.rpc("is_admin");
    if (rpcErr) return jsonError(`Auth check failed: ${rpcErr.message}`, 500);
    if (!isAdmin) return jsonError("Forbidden — admin only", 403);

    // ---- Fetch metadata from bilibili ------------------------------------
    const apiUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
    const apiResp = await fetch(apiUrl, {
      headers: {
        // Browser-ish UA, otherwise bilibili sometimes returns -412.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.bilibili.com/",
      },
    });
    if (!apiResp.ok) {
      return jsonError(`Bilibili API HTTP ${apiResp.status}`, 502);
    }
    const apiData: BilibiliApiResponse = await apiResp.json();
    if (apiData.code !== 0 || !apiData.data) {
      return jsonError(
        `Bilibili API error: ${apiData.message ?? "unknown"} (code ${apiData.code})`,
        502,
      );
    }

    const { title, pic, duration, pubdate } = apiData.data;

    // ---- Download the thumbnail ------------------------------------------
    const imgResp = await fetch(pic, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://www.bilibili.com/",
      },
    });
    if (!imgResp.ok) {
      return jsonError(
        `Could not download thumbnail (HTTP ${imgResp.status})`,
        502,
      );
    }
    const contentType = imgResp.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.split("/")[1]?.split(";")[0]?.toLowerCase() ?? "jpg";
    const imgBytes = new Uint8Array(await imgResp.arrayBuffer());

    // ---- Upload to our Storage bucket ------------------------------------
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
    const path = `${bvid}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await adminClient.storage
      .from("video-thumbnails")
      .upload(path, imgBytes, { contentType, upsert: false });
    if (uploadErr) {
      return jsonError(`Storage upload failed: ${uploadErr.message}`, 500);
    }

    const { data: urlData } = adminClient.storage
      .from("video-thumbnails")
      .getPublicUrl(path);

    return jsonResponse({
      bvid,
      title,
      thumbnailUrl: urlData.publicUrl,
      durationSec: duration,
      publishedAt: new Date(pubdate * 1000).toISOString().split("T")[0],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[fetch-bilibili-metadata]", msg);
    return jsonError(msg, 500);
  }
});
