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
  cast_type: "regular_cast" | "special_guest";
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
    castType: r.cast_type ?? "regular_cast",
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

/**
 * Videos with publish_at within [startDate, endDate] inclusive.
 * Both dates are YYYY-MM-DD strings. Used by the analytics page.
 */
export async function listVideosInRange(
  startDate: string,
  endDate: string,
): Promise<Video[]> {
  const { data, error } = await supabase
    .from("videos")
    .select("*, video_guests(guest_id)")
    .gte("published_at", startDate)
    .lte("published_at", endDate)
    .order("published_at", { ascending: false });
  if (error) throw error;
  return (data as VideoRow[]).map(rowToVideo);
}

export interface SearchVideosOpts {
  searchQuery?: string;
  /** Empty means "no guest filter". When set, AND-logic across IDs. */
  guestIds?: GuestId[];
  pageSize: number;
  /** Zero-based. */
  page: number;
}

export interface SearchVideosResult {
  videos: Video[];
  /** Total rows matching the filter (NOT just the current page). */
  total: number;
}

/**
 * Server-side filter + pagination for the dashboard. Returns one page of
 * results and the *total matching count*, so the UI can show "共 X 条" even
 * before all pages are loaded.
 *
 * Two-step when a guest AND filter is active: one RPC to get matching IDs,
 * one paginated query to fetch them. PostgREST can't express HAVING COUNT
 * inline, so we keep that piece in SQL.
 */
export async function searchVideos(
  opts: SearchVideosOpts,
): Promise<SearchVideosResult> {
  const start = opts.page * opts.pageSize;
  const end = start + opts.pageSize - 1;

  let allowedIds: string[] | null = null;
  if (opts.guestIds && opts.guestIds.length > 0) {
    const { data, error } = await supabase.rpc("videos_with_all_guests", {
      gids: opts.guestIds,
    });
    if (error) throw error;
    allowedIds = (data as { video_id: string }[]).map((r) => r.video_id);
    // Short-circuit: no video has every selected guest, no need to query.
    if (allowedIds.length === 0) return { videos: [], total: 0 };
  }

  let query = supabase
    .from("videos")
    .select("*, video_guests(guest_id)", { count: "exact" })
    .order("published_at", { ascending: false });

  const q = opts.searchQuery?.trim();
  if (q) query = query.ilike("title", `%${q}%`);
  if (allowedIds !== null) query = query.in("id", allowedIds);

  query = query.range(start, end);

  const { data, error, count } = await query;
  if (error) throw error;
  return {
    videos: (data as VideoRow[]).map(rowToVideo),
    total: count ?? 0,
  };
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
      cast_type: input.castType ?? "regular_cast",
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
  if (patch.castType !== undefined) update.cast_type = patch.castType;
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

/**
 * Replace the guest list for one video without touching its other fields.
 * Used by the "missing-guests" admin flow where admins only need to
 * assign guests, not edit metadata.
 */
export async function setVideoGuests(
  videoId: VideoId,
  guestIds: GuestId[],
): Promise<void> {
  const { error: dErr } = await supabase
    .from("video_guests")
    .delete()
    .eq("video_id", videoId);
  if (dErr) throw dErr;
  if (guestIds.length > 0) {
    const { error: iErr } = await supabase.from("video_guests").insert(
      guestIds.map((gid) => ({ video_id: videoId, guest_id: gid })),
    );
    if (iErr) throw iErr;
  }
}

/**
 * Videos with zero rows in video_guests — the admin's "to-do list" for
 * filling in guest assignments. Sorted newest-first.
 *
 * Implemented client-side over a single `videos` query because for our
 * scale (a few hundred rows) it's fast and avoids adding another SQL
 * function. Switch to a server-side function if the table grows past
 * a few thousand rows.
 */
export async function listVideosMissingGuests(): Promise<Video[]> {
  const { data, error } = await supabase
    .from("videos")
    .select("*, video_guests(guest_id)")
    .order("published_at", { ascending: false });
  if (error) throw error;
  return (data as VideoRow[])
    .map(rowToVideo)
    .filter((v) => v.guestIds.length === 0);
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
