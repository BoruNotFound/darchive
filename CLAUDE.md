# dawushiye-hr

HR/content management tool for 大五社 (dawushiye). Built with React + TypeScript + Vite, backed by Supabase.

## Quick Reference

- **Dev server**: `npm run dev`
- **Build**: `npm run build`
- **Seed DB**: `npm run seed` (uses service_role key, bypasses RLS)
- **Schema file**: `supabase/schema.sql` (idempotent — safe to re-run)
- **Edge Function**: `supabase/functions/fetch-bilibili-metadata/index.ts`

## Database Schema (Supabase)

### Tables

#### `guests`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | PK | URL-safe slug + 6-char random tail, generated from name |
| `name` | text | NOT NULL | |
| `cast_type` | text | NOT NULL, DEFAULT `'regular_cast'` | `'regular_cast'` or `'special_guest'` |
| `avatar_url` | text | nullable | Public URL from `guest-avatars` storage bucket |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |

#### `videos`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | PK | BV id from bilibili, or `'video-' + random` |
| `title` | text | NOT NULL | |
| `bilibili_url` | text | NOT NULL | Full bilibili URL |
| `published_at` | date | NOT NULL | YYYY-MM-DD |
| `duration_sec` | integer | nullable | Seconds |
| `thumbnail_url` | text | nullable | Public URL from `video-thumbnails` storage bucket |
| `is_collab` | boolean | NOT NULL, DEFAULT false | Collaborated video with other creators; excluded from dashboard & analytics |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | Auto-set by `set_updated_at()` trigger |

#### `video_guests` (M2M join)
| Column | Type | Constraints |
|--------|------|-------------|
| `video_id` | text | FK → videos(id) ON DELETE CASCADE |
| `guest_id` | text | FK → guests(id) ON DELETE CASCADE |
| | | PK (video_id, guest_id) |

Index: `video_guests_guest_id_idx` on `guest_id`

#### `admins`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `user_id` | uuid | PK, FK → auth.users(id) ON DELETE CASCADE | |
| `email` | text | NOT NULL | |
| `name` | text | nullable | |
| `added_at` | timestamptz | NOT NULL, DEFAULT now() | |
| `added_by` | uuid | nullable, FK → auth.users(id) | Self-referential |

#### `audit_log`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | bigserial | PK | |
| `video_id` | text | NOT NULL | |
| `action` | audit_action | NOT NULL | Enum: `'create'`, `'update'`, `'delete'` |
| `admin_user_id` | uuid | nullable | Null for service_role/seed |
| `admin_email` | text | NOT NULL | |
| `occurred_at` | timestamptz | NOT NULL, DEFAULT now() | |
| `diff` | jsonb | nullable | Full row (create/delete) or `{before, after}` (update) |

Indexes: `audit_log_video_id_idx`, `audit_log_occurred_at_idx` (DESC), `audit_log_admin_user_id_idx`

### Custom Types

- **`audit_action`** enum: `'create'`, `'update'`, `'delete'`

### Database Functions

| Function | Returns | Purpose |
|----------|---------|---------|
| `is_admin()` | boolean | SECURITY DEFINER. Checks if `auth.uid()` is in `admins` table. Used in RLS policies. |
| `videos_with_all_guests(gids text[])` | TABLE(video_id text) | AND-filter: returns videos containing ALL supplied guest IDs. |
| `log_video_change()` | trigger | AFTER INSERT/UPDATE/DELETE on `videos`. Writes to `audit_log`. Skips service_role context. |
| `set_updated_at()` | trigger | BEFORE UPDATE on `videos`. Sets `updated_at = now()`. |

### RLS Policies

| Table | SELECT | INSERT/UPDATE/DELETE |
|-------|--------|---------------------|
| guests, videos, video_guests | Public (anon + authenticated) | Admin only (`is_admin()`) |
| admins | Admin only | Admin only |
| audit_log | Admin only | None (trigger-only via SECURITY DEFINER) |

### Storage Buckets (public)

| Bucket | Path Convention | Access |
|--------|----------------|--------|
| `guest-avatars` | `<guest-id>/<timestamp>.<ext>` | Public read, admin write |
| `video-thumbnails` | `<bvid>/<timestamp>.<ext>` | Public read, admin write |

### Relationships

```
guests ←(1:M)— video_guests —(M:1)→ videos
videos ←(1:M)— audit_log
admins —(1:1)→ auth.users
admins.added_by —(M:1)→ auth.users
```

## Auth

- Magic-link OTP via Supabase Auth (`signInWithOtp`)
- Admin status = row exists in `admins` table, verified via `is_admin()` RPC

## Key Files

| File | Purpose |
|------|---------|
| `supabase/schema.sql` | Full DB schema (idempotent) |
| `src/lib/db.ts` | Data access layer (all Supabase queries) |
| `src/types/index.ts` | TypeScript type definitions |
| `src/lib/supabase.ts` | Supabase client initialization |
| `scripts/seed.ts` | Seed script with mock data |
| `supabase/functions/fetch-bilibili-metadata/index.ts` | Edge function: fetches bilibili video metadata + thumbnail |

## Adding a New Column

1. Add the column in `supabase/schema.sql` (use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
2. Run the schema SQL in the Supabase SQL editor (or via CLI)
3. Update the TypeScript type in `src/types/index.ts`
4. Update relevant queries in `src/lib/db.ts`
5. Update this CLAUDE.md with the new column
