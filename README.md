# Late Founders Command Center

The member workspace for Late Founders. Skool holds the teaching; the Command Center holds the doing. A member logs in, finds every worksheet and AI tool for the course they are on, does the work, and downloads what they produce.

**In this build:** Courses 01–05 and 12–14 (33 assets). Courses 06–11 come later.

## What is in it

- **Login, Dashboard, Course shelves, Asset pages, My Files.** Founder type, Freedom Number, 90-day target, first five moves and a next-action card on the dashboard. Every course is open; the member's route sets the recommended order and the Next up card.
- **One Assistant** (`src/lib/assistant/engine.ts`) runs every AI app as a *mode*. Each mode reads only its slice of the member record, never asks for what is already there, and ends by writing named fields back plus a downloadable document.
- **One member record** (`ProfileField` table, keys in `src/content/profile.ts`). Every asset reads and writes it, so the Go/No-Go Scorer sees the interview tally, the Offer-Builder sees the Hidden Assets Inventory, and the Valuation Estimator sees the Sellability Scorecard.
- **Everything saves, downloads and versions.** Worksheets autosave as you type. Completing or re-running anything adds a new version; earlier versions stay downloadable. Downloads are branded fillable PDFs, plus DOCX or XLSX where the spec asks.

## Run it on your Mac

You need Node.js 22 or newer.

```bash
git clone https://github.com/jaredicon856/late-founders.git
cd late-founders
cp .env.example .env          # then put your Claude API key in .env
npm install
npm run fonts                 # copies Montserrat into src/fonts and public/fonts
npx prisma db push            # creates the tables in the database in .env
npm run db:seed               # optional: demo member demo@latefounders.com / late-founders-demo
npm run dev                   # http://localhost:3000
```

Expect a few hundred MB on disk once dependencies are installed, almost all of it in `node_modules`.

## Environment variables

| Variable | Needed | What it does |
|---|---|---|
| `DATABASE_URL` | yes | Supabase **Transaction pooler** string (port 6543) + `?pgbouncer=true&connection_limit=1`. |
| `DIRECT_URL` | yes | Supabase **Session pooler** string (port 5432). Used to create and update tables. |
| `ANTHROPIC_API_KEY` | for AI apps | Claude API key. Without it the AI apps show a "not connected" notice. |
| `ANTHROPIC_MODEL` | no | Defaults to `claude-opus-5-5`. `claude-sonnet-5-5` costs half. |
| `SIGNUP_CODE` | recommended | Members need this code to create an account. Empty means open sign-up. |
| `TRADEMARK_API_URL`, `TRADEMARK_API_KEY` | no | Trademark search for the Availability-Sweep Agent. Without them the trademark column says "not cleared" and links to the USPTO search. |
| `CRON_SECRET` | recommended | Protects the daily keep-alive job (`/api/keepalive`, see `vercel.json`) that stops a Free-plan Supabase project pausing. |
| `TRANSCRIPTION_API_URL`, `TRANSCRIPTION_API_KEY` | no | Speech-to-text for SOP Generator recordings. Without them members paste or upload a transcript. |

Never commit `.env`.

## Deploying

Hosted on Vercel with Supabase Postgres (project `late-founders-command-center`, US East).

1. Import the GitHub repo in Vercel and set the environment variables above.
2. Every deploy runs `vercel-build`: type-check, tests, table sync (`prisma db push`), Row Level Security on every table, then the Next.js build. A failing test or a schema change that would delete data stops the deploy.

The app talks to the database only through Prisma on the server. Row Level Security with no policies keeps Supabase's public Data API closed.

## Checks

```bash
npm run typecheck
npm test
```

The tests check that every catalog asset has an implementation, every AI output schema is valid for strict tool use, every worksheet renders and exports to its formats, the one-page sheets fit on one page, and course unlocking follows the route.

## Where things live

```
src/content/catalog.ts       courses, assets, routes by founder type
src/content/profile.ts       member record fields
src/content/worksheets/      worksheets, guides, checklists, templates, calculators (one file per course)
src/content/modes/           AI app modes (one file per course)
src/lib/assistant/           the Assistant loop and save side effects
src/lib/docs, src/lib/export the document model and the PDF / DOCX / XLSX / zip exporters
src/lib/sweep.ts             Availability-Sweep checks
src/app                      pages and API routes
```

**Adding Course 06 later:** add the course and its assets to `catalog.ts`, write `worksheets/c06.ts` and `modes/c06.ts`, register them in `src/content/registry.ts`, and add 6 to each route. The tests fail until every new asset has an implementation.

## Known limits in this build

- **Login is the Command Center's own** (email and password). Skool SSO is an open question for Jared; swapping it in only touches `src/lib/auth.ts`.
- **Social handle checks:** GitHub and YouTube are checked automatically. Instagram, X, TikTok, LinkedIn and Facebook block automated lookups, so the tool links to each for a manual check and never reports them as free.
- **Data Room** ships as a downloadable zip. A Google Drive template has to be made by hand from the zip.
- **Sellability Scorecard** scores what the member enters; it has no chat step.
