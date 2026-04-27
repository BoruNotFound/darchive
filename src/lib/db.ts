// Data access layer.
//
// This is the ONLY module that knows where data physically lives.
// Phase 1 returned mock data. Phase 3 reads from Supabase.
// Phase 5 adds guest CRUD (create/update/delete).
// The read function signatures stay stable so components don't care.

import { supabase } from "@/lib/supabase";
import type {
  AuditAction,
  AuditLogEntry,
  Guest,
  GuestId,
  GuestInput,
  Video,
  VideoId,
  VideoInput,
} from "@/types";

// ---- Row shapes returned by Supabase (snake_case columns) ---------------

interface GuestRow {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface VideoRow {
  id: string;
  title: string;
  bilibili_url: string;
  published_at: string;
  duration_sec: number | null;
  thumbnail_url: string | null;
  // From the joined select(`*, video_guests(guest_id)`).
  video_guests: { guest_id: string }[];
}

// ---- Mappers: snake_case row → camelCase domain type --------------------

function rowToGuest(r: GuestRow): Guest {
  return {
    id: r.id,
    name: r.name,
    avatarUrl: r.avatar_url ?? undefined,
  };
}

function rowToVideo(r: VideoRow): Video {
  return {
    id: r.id,
    title: r.title,
    bilibiliUrl: r.bilibili_url,
    publishedAt: r.published_at,
    durationSec: r.duration_sec ?? undefined,
    thumbnailUrl: r.thumbnail_url ?? undefined,
    guestIds: r.video_guests.map((vg) => vg.guest_id),
  };
}

// ---- Public API ---------------------------------------------------------

export async function listVideos(): Promise<Video[]> {
  const { data, error } = await supabase
    .from("videos")
    .select("*, video_guests(guest_id)")
    .order("published_at", { ascending: false });

  if (error) throw error;
  return (data as VideoRow[]).map(rowToVideo);
}

export async function listGuests(): Promise<Guest[]> {
  const { data, error } = await supabase
    .from("guests")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data as GuestRow[]).map(rowToGuest);
}

// ---- Guest CRUD (admin-only; RLS gates the writes) ----------------------

/** Generate a stable, URL-safe guest id. Slug + 6-char random tail. */
function generateGuestId(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-一-鿿]/g, "")
    .slice(0, 24);
  const tail = Math.random().toString(36).slice(2, 8);
  return `${slug || "guest"}-${tail}`;
}

export async function createGuest(input: GuestInput): Promise<Guest> {
  const id = input.id ?? generateGuestId(input.name);
  const { data, error } = await supabase
    .from("guests")
    .insert({
      id,
      name: input.name,
      avatar_url: input.avatarUrl ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToGuest(data as GuestRow);
}

export async function updateGuest(
  id: GuestId,
  patch: Partial<GuestInput>,
): Promise<Guest> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.avatarUrl !== undefined) update.avatar_url = patch.avatarUrl;
  const { data, error } = await supabase
    .from("guests")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToGuest(data as GuestRow);
}

export async function deleteGuest(id: GuestId): Promise<void> {
  // Note: video_guests rows referencing this guest are removed via ON DELETE CASCADE.
  const { error } = await supabase.from("guests").delete().eq("id", id);
  if (error) throw error;
}

// ---- Video CRUD ---------------------------------------------------------

/**
 * Use the BV id as the canonical primary key when one is present in the URL.
 * Falls back to a random tail for hand-entered videos that don't have one
 * (rare — admins should always paste a real bilibili URL).
 */
function generateVideoId(bilibiliUrl: string): string {
  const m = bilibiliUrl.match(/BV[a-zA-Z0-9]+/);
  if (m) return m[0];
  return `video-${Math.random().toString(36).slice(2, 10)}`;
}

async function getVideoById(id: VideoId): Promise<Video> {
  const { data, error } = await supabase
    .from("videos")
    .select("*, video_guests(guest_id)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return rowToVideo(data as VideoRow);
}

export async function createVideo(input: VideoInput): Promise<Video> {
  const id = input.id ?? generateVideoId(input.bilibiliUrl);

  const { error: vErr } = await supabase.from("videos").insert({
    id,
    title: input.title,
    bilibili_url: input.bilibiliUrl,
    published_at: input.publishedAt,
    duration_sec: input.durationSec ?? null,
    thumbnail_url: input.thumbnailUrl ?? null,
  });
  if (vErr) throw vErr;

  if (input.guestIds.length > 0) {
    const { error: jErr } = await supabase.from("video_guests").insert(
      input.guestIds.map((gid) => ({ video_id: id, guest_id: gid })),
    );
    if (jErr) throw jErr;
  }

  return getVideoById(id);
}

export async function updateVideo(
  id: VideoId,
  patch: VideoInput,
): Promise<Video> {
  const update: Record<string, unknown> = {
    title: patch.title,
    bilibili_url: patch.bilibiliUrl,
    published_at: patch.publishedAt,
    duration_sec: patch.durationSec ?? null,
    thumbnail_url: patch.thumbnailUrl ?? null,
  };
  const { error: vErr } = await supabase
    .from("videos")
    .update(update)
    .eq("id", id);
  if (vErr) throw vErr;

  // Replace video_guests wholesale. Simpler than diffing — small N.
  const { error: dErr } = await supabase
    .from("video_guests")
    .delete()
    .eq("video_id", id);
  if (dErr) throw dErr;

  if (patch.guestIds.length > 0) {
    const { error: iErr } = await supabase.from("video_guests").insert(
      patch.guestIds.map((gid) => ({ video_id: id, guest_id: gid })),
    );
    if (iErr) throw iErr;
  }

  return getVideoById(id);
}

export async function deleteVideo(id: VideoId): Promise<void> {
  // ON DELETE CASCADE on video_guests handles the join cleanup.
  const { error } = await supabase.from("videos").delete().eq("id", id);
  if (error) throw error;
}

// ---- Audit log (read-only; only the trigger writes here) ----------------

interface AuditLogRow {
  id: number;
  video_id: string;
  action: AuditAction;
  admin_user_id: string | null;
  admin_email: string;
  occurred_at: string;
  diff: Record<string, unknown> | null;
}

function rowToAudit(r: AuditLogRow): AuditLogEntry {
  return {
    id: r.id,
    videoId: r.video_id,
    action: r.action,
    adminUserId: r.admin_user_id ?? undefined,
    adminEmail: r.admin_email,
    occurredAt: r.occurred_at,
    diff: r.diff ?? undefined,
  };
}

/** Most recent audit entries across all videos. RLS gates this to admins. */
export async function listAuditEntries(limit = 200): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as AuditLogRow[]).map(rowToAudit);
}

/** Audit history for a single video, newest-first. */
export async function listAuditEntriesForVideo(
  videoId: VideoId,
): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .eq("video_id", videoId)
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return (data as AuditLogRow[]).map(rowToAudit);
}
