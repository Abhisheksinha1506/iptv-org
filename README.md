## IPTV Fusion Hub

This repository hosts the **IPTV Fusion Hub**, a stream aggregation and analytics platform designed for Vercel's serverless stack. The app is written in Next.js 16 with the App Router, Tailwind CSS, and TypeScript, using Supabase for data storage.

## Requirements

- Node.js 18+
- npm 10+
- Supabase account and project
- GitHub personal access token (for API rate limits)

## Environment Configuration

1. Copy the sample environment file:

   ```bash
   cp env.example .env.local
   ```

2. Fill in the following values:

   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (from Supabase dashboard → Settings → API)
   - `GITHUB_TOKEN`: Personal access token for higher rate limits when polling source repositories
   - `NEXT_PUBLIC_APP_URL`: Your app URL (defaults to `http://localhost:3000` for local dev)
   - `NEXT_PUBLIC_APP_NAME`: App name (defaults to "IPTV Fusion Hub")

## Database Setup

1. Create a Supabase project at https://supabase.com
2. Run the migration SQL file in your Supabase SQL editor:
   - File: `supabase/migrations/001_initial_schema.sql`
   - This creates all required tables: `channels`, `test_results`, `quality_metrics`, `repositories`, `repository_updates`

## Scripts

| Command                  | Description                                  |
| ------------------------ | -------------------------------------------- |
| `npm run dev`            | Start the Next.js dev server                  |
| `npm run build`          | Create a production build                     |
| `npm run start`          | Run the built app                             |
| `npm run lint`           | Execute ESLint with Next.js + Prettier config |
| `npm run format`          | Format source files with Prettier             |
| `npm run format:check`    | Verify formatting without making changes      |
| `npm run cron:*`         | Hit local cron endpoints (requires dev server)|

### Local Cron Simulator

Vercel Cron requests are emulated locally via `scripts/run-cron.mjs`. Start `npm run dev` in one terminal, then from another terminal run:

```bash
npm run cron:check-and-update  # Main cron job (checks repos, updates, and tests)
npm run cron:check              # Check for repository updates only
npm run cron:update             # Update sources only
npm run cron:test               # Test streams only
npm run cron:metrics            # Calculate quality metrics
```

Each command issues an HTTP request to the corresponding `/api/cron/*` route so you can debug scheduled workflows without deploying to Vercel.

## Automated Polling

The application uses **polling** to check for repository updates every **12 hours** via Vercel Cron:

- **Schedule**: Every 12 hours (configured in `vercel.json`)
- **Endpoint**: `/api/cron/check-and-update`
- **Process**: 
  1. Checks tracked repositories for updates (compares commit SHAs)
  2. Fetches and parses M3U files from updated repositories
  3. Saves channels to Supabase
  4. Automatically tests channels from updated repositories
  5. Calculates and saves quality metrics

This approach eliminates the need for GitHub webhooks and ensures reliable updates even if webhooks fail.

## Architecture

- **Storage**: Supabase PostgreSQL database
- **Caching**: Next.js ISR (Incremental Static Regeneration) with 1-hour revalidation
- **Polling**: Vercel Cron jobs run every 12 hours to check for repository updates
- **Real-time**: Server-Sent Events (SSE) for live update notifications in the dashboard
- **Testing**: Automated stream testing triggered when repositories are updated

## Features

- Automatic repository monitoring and channel aggregation
- Stream quality testing and metrics calculation
- Real-time dashboard with filtering and pagination
- ISR for fast page loads with automatic background updates
- Comprehensive quality scoring based on uptime, stability, video quality, and geo-availability
