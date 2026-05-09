# 大物是也 · 视频面板

视频来源：[大物是也Bilibili主页](https://space.bilibili.com/178429408)

**Live site: https://borunotfound.github.io/dawushiye-dashboard/**

---

## Features

**Public**
- Browse all videos with infinite scroll, sorted by publish date
- Search by title
- Filter by one or more guests (AND logic — results contain all selected guests)
- Analytics page: guest appearance counts and rates by year or custom date range

**Admin** (magic-link login required)
- Create, edit, and delete videos and guests
- Auto-fetch video metadata from Bilibili URLs
- Bulk-assign guests to videos that have none
- Audit log of all changes

---

## Tech stack

| Layer | Choice |
|---|---|
| UI | React 18 + TypeScript + Tailwind CSS 4 |
| Routing | React Router v6 |
| Build | Vite 6 |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| Hosting | GitHub Pages |

---

## Local development

### 1. Prerequisites

- Node.js 22+
- A [Supabase](https://supabase.com) project with the schema applied (see `supabase/schema.sql`)

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
SUPABASE_SECRET_KEY=your-service-role-key   # local scripts only, never committed
```

### 3. Install and run

```bash
npm install
npm run dev       # http://localhost:5173
```

### Other scripts

| Command | Description |
|---|---|
| `npm run build` | Type-check and build to `/dist` |
| `npm run preview` | Preview the production build locally |
| `npm run typecheck` | Type-check without emitting |
| `npm run seed` | Seed the database with mock data (one-time) |
| `npm run import-videos` | Bulk-import videos from a Bilibili user channel |

---

## Deployment

The site is deployed to GitHub Pages via a manual GitHub Actions workflow. Trigger it from **Actions → Run workflow**. Supabase credentials are stored as repository secrets.

---

## Database setup

Run `supabase/schema.sql` in the Supabase SQL editor to create all tables, RLS policies, and triggers. See `supabase/README.md` for instructions on granting admin access.
