# YT Manager

YT Manager combines a Cloudflare Pages web dashboard with an optional Windows desktop shell (Electron) for real YouTube browsing.

## Architecture
- Web dashboard: Vite + vanilla TypeScript, deployed to Cloudflare Pages.
- Database/auth: Supabase. The database stores account metadata only; never Google passwords, browser cookies, or session tokens.
- Desktop: Electron with a dedicated persistent Chromium session per selected YouTube account.
- YouTube pages are loaded as first-party browser content in Electron, not embedded in an iframe.

## Setup
1. Copy `.env.example` to `.env.local` and set the Supabase URL and publishable key.
2. Run `npm install`.
3. Run `npm run dev` for the web dashboard.
4. Run `npm run desktop:dev` for the desktop shell.

## Cloudflare Pages
- Build command: `npm run build`
- Output directory: `dist`
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (or publishable key) in Pages environment variables.

## Database
Apply `supabase/migrations/202611130001_initial_schema.sql` in Supabase SQL Editor. New public tables are explicitly granted to authenticated users and protected by RLS.

## Important
The desktop app creates one persistent Electron session partition per account. Google login occurs directly on the official Google/YouTube pages. The app does not collect Google passwords or export cookies. Use accounts you own or are authorized to manage and follow YouTube/Google policies.
