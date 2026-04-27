# Supabase setup

Single-source-of-truth for the database. The `schema.sql` file is the entire schema — paste it into Supabase's SQL editor and run.

## First-time setup

1. Create the Supabase project (see chat with Claude for the walkthrough).
2. Open the SQL editor → paste `schema.sql` → Run.
3. Add your `.env.local` to the project root (see `.env.example`).
4. Run the seed script: `npm run seed` (added in Phase 3 wiring).

## Bootstrapping the first admin

Auth is set up so only rows in the `admins` table can write data, but there's
no admin yet. Cold-start fix:

1. Sign up via the app's `/admin` login page (Phase 4).
2. After your `auth.users` row exists, run this in Supabase SQL editor — replace the email with yours:

```sql
INSERT INTO admins (user_id, email, name)
SELECT id, email, 'Boru'
FROM auth.users
WHERE email = 'your-email@example.com';
```

After that, you can invite further admins from inside the app.

## Schema at a glance

- `guests` — every person who has appeared in a video.
- `videos` — one row per uploaded video.
- `video_guests` — many-to-many join (canonical source of truth for who-was-in-what).
- `admins` — gate for write access. RLS checks `is_admin()` on every write.
- `audit_log` — auto-populated by a trigger on `videos`. Clients can't write here directly.

## Re-running the schema

Every statement in `schema.sql` is idempotent (`IF NOT EXISTS`, `OR REPLACE`,
`DROP POLICY IF EXISTS`...). You can edit and re-run the whole file safely.
For destructive schema changes, just run them ad-hoc in the SQL editor.
