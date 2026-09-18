# ReviewDesk – Code Review as a Service

Upload a ZIP of a repository (or a handful of source files), let a background worker run **static analysis + an AI code review**, and get back a **prioritised list of findings** with file, line, explanation and a suggested fix.

Built on the [Selleo boilerplate](https://github.com/Selleo/boilerplate) (NestJS + React Router 7 + BullMQ + Drizzle) and adapted into a single-purpose product.

---

## Table of Contents

1. [What it does](#what-it-does)
2. [Architecture](#architecture)
3. [Quickstart](#quickstart)
4. [Configuration](#configuration)
5. [Local URLs](#local-urls)
6. [Tooling Commands](#tooling-commands)
7. [How a review is processed](#how-a-review-is-processed)
8. [Static analysis rules](#static-analysis-rules)
9. [AI review](#ai-review)
10. [API](#api)
11. [Project layout](#project-layout)
12. [Testing](#testing)
13. [CI & Deployment](#ci--deployment)
14. [Limits & known gaps](#limits--known-gaps)
15. [License](#license)

---

## What it does

| Feature | Details |
| --- | --- |
| **Upload** | Drag & drop a `.zip` export of a repo or up to 50 individual files (25 MB each). `node_modules`, build output, lockfiles, binaries and files > 256 KB are skipped automatically. Zip-slip paths are rejected. |
| **Background processing** | Every upload becomes a BullMQ job on Redis. The dashboard polls and shows live progress (queued → analysing → completed / failed). Failed reviews can be re-run. |
| **Static analysis** | ~20 deterministic rules: hard-coded secrets, `eval`/`exec`, shell & SQL injection patterns, unsafe HTML, disabled TLS verification, weak hashing, debugger/print leftovers, loose equality, explicit `any`, committed `.env`, merge-conflict markers, TODOs, oversized files… |
| **AI review** | Claude reads the code like a senior reviewer (bugs, missing authorization, races, N+1, structure) and returns findings through **structured outputs**. Batched to fit an input budget, with prompt caching. A `mock` adapter keeps the pipeline usable without an API key. |
| **Prioritised results** | Findings are ranked **critical → high → medium → low → info**, tagged by category (security, bug, performance, maintainability, …) and source (static / AI). Filter by priority, category, source and file. |
| **Auth & accounts** | Better Auth (email + password with verification, Google OAuth, admin role). Users only see their own reviews. |

---

## Architecture

```
apps/web-app (React Router 7 SPA)
   │  multipart upload / polling (TanStack Query)
   ▼
apps/api (NestJS)
   ├─ ReviewsController  ── POST /reviews ──► S3 (uploads) + Postgres (review row)
   │                                         └─► BullMQ queue "review-analysis-queue"
   └─ ReviewsAnalysisConsumer (worker, concurrency 2)
         1. download uploads from S3, extract ZIP, filter files
         2. static analysis (rules in apps/api/src/reviews/analysis/static-analyzer.ts)
         3. AI review (Anthropic adapter, structured JSON output)
         4. merge + de-duplicate → review_finding rows, status = completed
```

Infrastructure (via `docker-compose.yml`): Postgres 16, Redis 7, RustFS (S3-compatible object storage), Mailpit (dev mailbox). Bull Board is mounted at `/queues` for job inspection.

---

## Quickstart

1. Install tooling (see [Prerequisites](#prerequisites) below).
2. Install dependencies:
   ```sh
   pnpm install
   ```
3. Bootstrap environment files:
   ```sh
   cp apps/api/.env.example apps/api/.env
   cp apps/web-app/.env.example apps/web-app/.env
   ```
   Set `AI_REVIEW_ADAPTER=anthropic` and `ANTHROPIC_API_KEY=...` in `apps/api/.env` to enable real AI review (the default `mock` adapter runs offline).
4. Start infrastructure services:
   ```sh
   docker compose up -d
   ```
   This starts Postgres, Redis, RustFS (and creates the `reviewdesk-uploads` bucket) and Mailpit.
5. Run migrations:
   ```sh
   pnpm db:migrate
   ```
6. Trust the local HTTPS certificates once:
   ```sh
   cd apps/reverse-proxy && caddy run
   ```
   Accept the prompts, then stop it; `pnpm dev` starts it from now on.
7. From the repo root, launch everything (API, web app, Caddy):
   ```sh
   pnpm dev
   ```
8. Open https://app.reviewdesk.localhost, create an account (verification email lands in Mailpit at https://mailbox.reviewdesk.localhost), then **Dashboard → New review** and drop a ZIP.

### Prerequisites

- Node.js ≥ 24.8.0 (`.nvmrc` / `.tool-versions`) and pnpm 10.
- Docker (Compose V2).
- Caddy for local HTTPS (`brew install caddy` on macOS).
- Optional: an Anthropic API key for AI review.

---

## Configuration

`apps/api/.env` (see `.env.example` for every variable):

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL`, `DATABASE_TEST_URL` | Postgres connections | `postgres://postgres:reviewdesk@localhost:5432/reviewdesk` |
| `REDIS_URL` | BullMQ connection | `redis://localhost:6379` |
| `BULLBOARD_PASSWORD` | Basic-auth password for `/queues` (user `admin`) | `admin123` |
| `FILE_STORAGE_ADAPTER`, `AWS_BUCKET_NAME`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, `AWS_*` | Object storage for uploads (RustFS locally, S3 in prod) | RustFS on `127.0.0.1:9000`, bucket `reviewdesk-uploads` |
| `AI_REVIEW_ADAPTER` | `anthropic` \| `mock` \| `disabled` | `mock` |
| `ANTHROPIC_API_KEY` | Required when adapter is `anthropic` | – |
| `AI_REVIEW_MODEL` | Claude model id | `claude-opus-5` |
| `AI_REVIEW_EFFORT` | `low` \| `medium` \| `high` \| `xhigh` \| `max` | `high` |
| `AI_REVIEW_MAX_INPUT_CHARS` | Characters of source per model request (batch size) | `200000` |
| `AI_REVIEW_MAX_BATCHES` | Max model requests per review; remaining files get static-only review | `3` |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID/SECRET` | Authentication | see example |
| `EMAIL_ADAPTER`, `SMTP_*` | `mailhog` (Mailpit) locally, `smtp`/`ses` in prod | `mailhog` |
| `CORS_ORIGIN`, `COOKIE_DOMAIN` | Production origins | `*.reviewdesk.localhost` |

`apps/web-app/.env`: `VITE_API_URL=https://api.reviewdesk.localhost`.

Upload/processing limits live in `apps/api/src/reviews/reviews.constants.ts` (50 uploads × 25 MB, 300 source files, 256 KB per file, 20 MB total source).

---

## Local URLs

| Service | URL |
| --- | --- |
| Web app | https://app.reviewdesk.localhost |
| API | https://api.reviewdesk.localhost |
| Swagger UI | https://api.reviewdesk.localhost/api |
| Bull Board (queues) | https://api.reviewdesk.localhost/queues |
| Mailpit | https://mailbox.reviewdesk.localhost |
| RustFS console | http://localhost:9001 (`rustfsadmin` / `rustfsadmin`) |

---

## Tooling Commands

| Task | Command |
| --- | --- |
| Start everything | `pnpm dev` |
| API only / web only | `pnpm --filter reviewdesk-api dev` / `pnpm --filter reviewdesk-web-app dev` |
| Generate migration | `pnpm db:generate -- --name your_migration_name` |
| Run migrations | `pnpm db:migrate` |
| Regenerate typed API client (after changing controllers; the API writes `apps/api/src/swagger/api-schema.json` on boot) | `pnpm generate:client` |
| Lint / format | `pnpm lint` / `pnpm format` |
| Type-check API | `pnpm typecheck:api` |
| Tests | `pnpm test:api`, `pnpm test:api:e2e`, `pnpm test:web` |
| Build shared packages (needed before API typecheck on a fresh clone) | `pnpm build-email && pnpm build-shared` |

---

## How a review is processed

1. `POST /api/v1/reviews` (multipart, field `files[]`, optional `title`, `aiEnabled`) stores each upload in object storage (`reviews/<id>/uploads/…`, tracked in the `file` table with `entity_ref = review:<id>`), inserts a `review` row with status `pending` and enqueues `ANALYZE_REVIEW`.
2. The worker (`ReviewsAnalysisConsumer`) sets `processing`, downloads the uploads, extracts ZIPs (with zip-slip protection and common-root stripping), filters vendored/binary/oversized files, detects languages and stores `review_file` rows. Progress is written to `review.progress` (5 → 25 → 45 → 90 → 100) so the UI can poll `GET /reviews/:id`.
3. Static rules run on every file.
4. If `aiEnabled` and the adapter is not `disabled`, files are ordered (code first, docs/config last), split into batches under `AI_REVIEW_MAX_INPUT_CHARS`, and each batch is sent to Claude with the static findings listed as "already detected". A failure of the AI step does not fail the review; it is stored in `review.ai_error` and shown in the UI.
5. AI findings that duplicate a static finding (same file, same category, line ±1) are dropped; everything is sorted by priority → file → line and saved to `review_finding`. The review becomes `completed` with a summary (from the model, or a generated static summary).
6. Any exception marks the review `failed` with `error_message`; **Re-run analysis** clears findings and enqueues again.

---

## Static analysis rules

Defined in `apps/api/src/reviews/analysis/static-analyzer.ts`. Each rule has an id, priority, category, optional language filter, false-positive guards and a per-file cap for noisy rules.

| Rule | Priority | Category |
| --- | --- | --- |
| `hardcoded-secret` (API keys, AWS keys, private keys, Slack/GitHub/Anthropic/Stripe tokens, `password = "…"`) | critical | security |
| `merge-conflict-marker` | critical | bug |
| `eval-usage`, `python-dynamic-exec`, `dangerous-html`, `shell-injection`, `sql-injection`, `disabled-tls-verification`, `env-file-committed` | high | security |
| `debugger-statement`, `python-breakpoint`, `empty-catch-block`, `python-bare-except` | medium | bug |
| `weak-random-for-secret`, `weak-hash`, `cors-wildcard-with-credentials` | medium | security |
| `loose-equality` | low | bug |
| `explicit-any`, `console-statement`, `large-file` | low | maintainability |
| `insecure-http-url` | low | security |
| `todo-comment`, `python-print`, `long-lines` | info | maintainability / style |

Add a rule by appending to `LINE_RULES` (per line) or `FILE_RULES` (per file) and covering it in `src/reviews/__tests__/static-analyzer.spec.ts`.

---

## AI review

`apps/api/src/reviews/analysis/anthropic-reviewer.adapter.ts` uses the official `@anthropic-ai/sdk`:

- Streaming `messages.stream(...).finalMessage()` so large inputs don't hit HTTP timeouts.
- `output_config.format` = JSON schema (`summary` + `findings[]` with file, line, priority, category, title, description, suggestion) so the response is always parseable.
- `output_config.effort` from `AI_REVIEW_EFFORT`; system prompt is cached with `cache_control`.
- Handles `refusal` and `max_tokens` stop reasons explicitly; resolves fuzzy file paths back to uploaded paths and attaches the referenced source line as a snippet.

Adapters implement `AiReviewerAdapter`; switch with `AI_REVIEW_ADAPTER`. The `mock` adapter emits deterministic heuristic findings and is used in tests and CI.

---

## API

All endpoints require a Better Auth session cookie and are versioned under `/api/v1`. Full schema in Swagger UI.

| Method & path | Description |
| --- | --- |
| `POST /reviews` | Multipart upload (`files[]`, `title?`, `aiEnabled?`). Returns the created review. |
| `GET /reviews` | Current user's reviews with per-priority finding counts. |
| `GET /reviews/stats` | Totals for the dashboard overview. |
| `GET /reviews/:id` | Review, analysed files and findings (sorted by priority). |
| `POST /reviews/:id/retry` | Reset and re-enqueue a completed/failed review. |
| `DELETE /reviews/:id` | Delete the review and its stored uploads. |

The web app consumes the generated client `apps/web-app/app/api/generated-api.ts` (`pnpm generate:client`).

---

## Project layout

| Path | Description |
| --- | --- |
| `apps/api/src/reviews/` | Reviews feature: controller, service, queue producer, worker (`reviews-analysis.consumer.ts`), Drizzle schema, TypeBox response schemas. |
| `apps/api/src/reviews/analysis/` | `source-collector.ts` (ZIP extraction & filtering), `static-analyzer.ts`, AI adapters, prompt & batching helpers. |
| `apps/api/src/file-storage/` | S3-compatible storage adapter (upload/download/delete) and `file` table. |
| `apps/api/src/storage/migrations/` | Drizzle migrations (`0003_reviews_init.sql` adds review tables). |
| `apps/web-app/app/modules/reviews/` | Reviews list, upload page (`new-review.page.tsx`), details page with filters, shared components. |
| `apps/web-app/app/modules/dashboard/` | Overview page (stat tiles, recent reviews) and admin users page. |
| `apps/web-app/app/api/` | Generated client plus TanStack Query hooks (`queries/useReview*.ts`, `mutations/use*Review.ts`). |
| `apps/reverse-proxy/` | Caddyfile for `*.reviewdesk.localhost`. |
| `packages/` | Email templates, shared ESLint/TS configs, shared utilities. |

---

## Testing

- **API unit** (`pnpm test:api`): pure tests for the static analyzer, source collector, batching, merging and the mock adapter live in `apps/api/src/reviews/__tests__/`; the existing users tests need Postgres + Redis.
- **API e2e** (`pnpm test:api:e2e`): `reviews.controller.e2e-spec.ts` registers a user, uploads two files through the real HTTP layer, waits for the in-process worker to finish and asserts the stored findings. Uses an in-memory storage adapter, so no S3 is needed; requires Postgres and Redis (as in CI).
- **Web** (`pnpm test:web`): Vitest + Testing Library.

---

## CI & Deployment

- GitHub Actions run lint, type-check, build and tests for API (`pull-request-api.yml`, with Postgres/Redis services and `AI_REVIEW_ADAPTER=mock`) and web (`pull-request-web.yml`) on every PR.
- `deploy-production-*.yml` are scaffolds for AWS (ECR + Terraform); supply your own secrets before enabling.
- `apps/api/Dockerfile` builds a production image; `entrypoint.sh migrate` runs migrations, `entrypoint.sh server` starts the API + worker.
- `wrangler.jsonc` shows how to host the SPA on Cloudflare; `.replit` runs the web app only against a hosted API.

---

## Limits & known gaps

- The API process also runs the BullMQ worker; for heavier load run a second instance and disable HTTP there (or split the consumer into its own module).
- Findings are stored per review; there is no cross-review history or diffing yet.
- Static rules are regex based and tuned for low noise, not completeness; treat them as a first pass, the AI review as the second.
- Uploads are kept in object storage until the review is deleted.

---

## License

MIT – see `LICENSE`. Originally derived from the Selleo boilerplate (MIT).
