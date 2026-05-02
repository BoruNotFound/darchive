// Core domain types for the dashboard.
// Kept separate so they can be reused by the data layer, components,
// and (later) the Supabase seed script.

export type GuestId = string;
export type VideoId = string;

/**
 * Cast role.
 *   - regular_cast : 常驻嘉宾 (counted by analytics)
 *   - special_guest: 特邀嘉宾 (excluded from analytics)
 *
 * String union (rather than boolean) so we can add more roles later
 * without another migration.
 */
export type CastType = "regular_cast" | "special_guest";

export interface Guest {
  id: GuestId;
  name: string;
  castType: CastType;
  /** Public URL of an uploaded avatar (Supabase Storage). Falls back to initials. */
  avatarUrl?: string;
}

/** Shape used when creating or updating a guest from the admin UI. */
export interface GuestInput {
  id?: GuestId;
  name: string;
  castType?: CastType;
  avatarUrl?: string | null;
}

export interface Video {
  id: VideoId;
  title: string;
  /** Full bilibili URL, e.g. https://www.bilibili.com/video/BVxxxxxxxxxx */
  bilibiliUrl: string;
  /** ISO 8601 date string. Using string (not Date) keeps JSON round-trips clean. */
  publishedAt: string;
  /**
   * Guest IDs that appeared in the video. This is a denormalized read-side
   * shape; the Supabase store will keep a canonical `video_guests` join table.
   */
  guestIds: GuestId[];
  durationSec?: number;
  /** Public URL of the cover image, fetched from bilibili and stored in our bucket. */
  thumbnailUrl?: string;
}

/** Shape used when creating or updating a video from the admin UI. */
export interface VideoInput {
  id?: VideoId;
  title: string;
  bilibiliUrl: string;
  publishedAt: string;
  durationSec?: number | null;
  thumbnailUrl?: string | null;
  guestIds: GuestId[];
}

export type AuditAction = "create" | "update" | "delete";

export interface AuditLogEntry {
  id: number;
  videoId: VideoId;
  action: AuditAction;
  adminEmail: string;
  adminUserId?: string;
  occurredAt: string;
  /** Raw diff payload written by the SECURITY DEFINER trigger.
   *  - create / delete: full row snapshot
   *  - update: { before, after } */
  diff?: Record<string, unknown>;
}
