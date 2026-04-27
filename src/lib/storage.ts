// Helpers for uploading user-supplied files into Supabase Storage.
// Public URLs come back so we can store them on row records (e.g. guests.avatar_url).

import { supabase } from "@/lib/supabase";
import type { GuestId } from "@/types";

const GUEST_AVATARS_BUCKET = "guest-avatars";

interface UploadedAvatar {
  /** Storage path (relative to bucket) — useful if we ever need to delete. */
  path: string;
  /** Permanent public URL — store this on guests.avatar_url. */
  publicUrl: string;
}

/**
 * Upload an avatar image for a guest.
 *
 * Path convention: `<guest-id>/<timestamp>.<ext>`. Old uploads accumulate
 * (cheap; 1 GB free tier) and are garbage-collected during a future cleanup
 * task — keeps the upload itself simple and idempotent.
 */
export async function uploadGuestAvatar(
  guestId: GuestId,
  file: File,
): Promise<UploadedAvatar> {
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `${guestId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(GUEST_AVATARS_BUCKET)
    .upload(path, file, {
      contentType: file.type || `image/${ext}`,
      upsert: false,
    });
  if (error) throw error;

  const { data } = supabase.storage
    .from(GUEST_AVATARS_BUCKET)
    .getPublicUrl(path);

  return { path, publicUrl: data.publicUrl };
}
