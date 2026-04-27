// Frontend wrapper for the `fetch-bilibili-metadata` Edge Function.
//
// Keeping the call shape on this side (and the Edge Function on the other)
// means the rest of the app doesn't need to know about Deno or how the
// metadata pipe works — just `fetchBilibiliMetadata(url)` returns the
// data we need to populate the video form.

import { supabase } from "@/lib/supabase";

export interface BilibiliMetadata {
  bvid: string;
  title: string;
  /** Public URL of the thumbnail in our `video-thumbnails` bucket. */
  thumbnailUrl: string;
  durationSec: number;
  /** YYYY-MM-DD. */
  publishedAt: string;
}

export async function fetchBilibiliMetadata(
  videoUrl: string,
): Promise<BilibiliMetadata> {
  const { data, error } = await supabase.functions.invoke<BilibiliMetadata>(
    "fetch-bilibili-metadata",
    { body: { videoUrl } },
  );
  if (error) {
    // supabase.functions.invoke wraps non-2xx responses; pull a useful message.
    throw new Error(error.message || "Edge function call failed");
  }
  if (!data) throw new Error("Empty response from edge function");
  return data;
}

/** Quick BVID extractor for client-side validation before we even call the function. */
export function extractBvid(url: string): string | null {
  const m = url.match(/BV[a-zA-Z0-9]+/);
  return m ? m[0] : null;
}
