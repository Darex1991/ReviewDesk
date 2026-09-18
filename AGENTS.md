# Repository Guidelines

ReviewDesk is a "Code Review as a Service": users upload a ZIP/files, a BullMQ worker runs static analysis + an AI review, results are a prioritised finding list. Read `README.md` first.

## Project Structure & Module Organization

- `apps/api`: NestJS backend. Feature folders: `reviews` (controller, service, queue producer, worker consumer, Drizzle + TypeBox schemas, `analysis/` with the static analyzer and AI adapters), `users`, `auth`, `file-storage`, `common`, `storage` (Drizzle migrations). `test/` holds Vitest setup, factories and helpers (in-memory storage adapter, BullMQ harness).
- `apps/web-app`: React Router 7 SPA. UI primitives in `app/components/ui`, domain code in `app/modules/<domain>` using `name.page.tsx` / `name.layout.tsx`; API access via the generated client and hooks in `app/api/{queries,mutations}`.
- `apps/reverse-proxy`: Caddy config for `*.reviewdesk.localhost`.
- `packages/`: `email-templates`, `config-eslint`, `typescript-config`, `shared`.

## Build, Test, and Development Commands

- Install deps: `pnpm install` (Node 24+, pnpm 10). Build shared packages once: `pnpm build-email && pnpm build-shared`.
- Start everything: `pnpm dev`; focused: `pnpm --filter reviewdesk-api dev`, `pnpm --filter reviewdesk-web-app dev`.
- Database: `pnpm db:generate -- --name your_migration_name`, `pnpm db:migrate`.
- After changing API controllers/schemas: boot the API once (it writes `apps/api/src/swagger/api-schema.json`) then `pnpm generate:client`.
- Quality: `pnpm lint`, `pnpm format`, `pnpm typecheck:api`, `pnpm --filter reviewdesk-web-app typecheck`.

## Coding Style & Naming Conventions

- TypeScript, 2-space indentation, Prettier + ESLint (`@repo/eslint-config`).
- Nest classes in PascalCase, filenames kebab-case (`reviews-analysis.consumer.ts`). Queues are defined in `*.queue.ts` constants; producers/consumers follow the `users` example.
- API responses are wrapped in `BaseResponse` and validated with TypeBox via `@Validate` so the Swagger client stays typed.
- Frontend components/hooks in PascalCase / `useX`; keep domain code inside its module. Priority/status colours live in `app/modules/reviews/review.utils.ts` and always ship with a label or icon.
- Never commit `.env`; derive from `.env.example`.

## Testing Guidelines

- API unit: `pnpm test:api` (colocated `__tests__/*.spec.ts`; the reviews analyzer tests are pure and run without services).
- API e2e: `pnpm test:api:e2e` (needs Postgres + Redis; override `FileStorageAdapter` with `InMemoryFileStorageAdapter`).
- Web: `pnpm test:web`.
- New static rules must come with a case in `static-analyzer.spec.ts`.

## Commit & Pull Request Guidelines

- Conventional commits (`feat: add sql-injection rule`), small and imperative; mention migrations/env changes in the body.
- PRs list executed commands, attach UI screenshots for visual changes and flag new env vars.

## Environment & Security Tips

- `docker compose up -d` before migrations; RustFS bucket `reviewdesk-uploads` is created automatically.
- AI review defaults to the offline `mock` adapter; set `AI_REVIEW_ADAPTER=anthropic` + `ANTHROPIC_API_KEY` to use Claude. Never log uploaded source contents.
- Uploaded archives are untrusted input: keep the zip-slip and size guards in `analysis/source-collector.ts`.
