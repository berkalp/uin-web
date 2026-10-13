# Card read performance v178

Baseline: `925e0e9ff1d96ac853153f1d33f089ff427fdd23`.

This change preserves catalogue ordering, card hierarchy, counters, viewer-specific visibility, and existing API response fields. It removes duplicate rating work from summary reads, stops unscheduled projection batches after a failure, and invalidates category caches and stale responses when the viewer changes. No shared cache stores private card data.

The SQL migration adds a target-first latest-active-placement index, evaluates stable viewer checks through statement-level scalar subqueries, and batches rating closure traversal. It retains the v175 rating eligibility/ranking and the installed visibility predicates, security-definer mode and grants.

## Validation

- `npm ci --ignore-scripts`
- `npx tsc --noEmit -p tsconfig.next.json`
- `npm run build`
- `node --test tests/library-api-fail-closed-v143.mjs tests/club-catalogue-lazy-v164.mjs tests/multi-category-cards-v177.mjs tests/shared-library-parity-v171.mjs tests/card-read-budget-v178.mjs`
- Install `@electric-sql/pglite` outside the repository, then set `PGLITE_MODULE` to its `dist/index.js` and run `node --test tests/card-read-budget-sql-v178.mjs`.

The PGlite fixture executes the migration and compares pre/post results for anonymous, ordinary and admin viewers, alias and hidden-child traversal, duplicate targets, invalid/null targets, ratings, and function grants. Its closure is a fixture, not the complete production schema.

## Deployment gate

Before applying SQL, confirm the production Supabase project and migration history. Capture the installed function definitions and a database backup/restore point. Compare pre/post full-schema card results for anonymous, owner, friend and admin sessions (hidden cards, aliases, hierarchy, ratings and counters); record EXPLAIN (ANALYZE, BUFFERS) for the known slow requests. Apply during a quiet period: lock_timeout is 5 seconds and statement_timeout 120 seconds, so lock contention aborts the transaction rather than waiting indefinitely. The index is not built concurrently because the migration is transactional.

Application changes have no dependency on new RPC names and can be reverted independently. Database rollback should restore the captured function definitions, not an assumed repository version.

On 2026-10-12, the production database migration was applied as `20261012194536` / `card_read_budget_v178` through an atomic repeatable-read parity guard. Five readers were compared for anonymous, two ordinary and one admin viewer; complete sampled results and function grants matched. A first guard attempt failed on a temporary-table column name and rolled back completely; the corrected guard also passed a local PostgreSQL fixture test before application. The original live function definitions were saved for rollback.

Single SQL measurements for the book category: placement query 1255 ms before / 335 ms after; catalogue summaries 1139 ms before / 1974 ms first post-change run / 721 ms subsequent warm run. These are database timings under different cache conditions, not a controlled benchmark or user-facing page-load improvement. Supabase is in eu-central-1; the Vercel default remains iad1. GitHub connector write calls returned HTTP 403. The tested application tree was subsequently published through the signed-in GitHub UI as PR #1 and merged as c196dd6fe7451d850c541345704d5b386c277913. Vercel production deployment 4SR5cneXDBAr2fWJZA8GYvCiy9zT is Ready/Current on uin.onl. Region and Speed Insights settings remain unchanged.

## Remaining work

The v178 release did not enable server pagination: existing global ranking, friend-based sorting, hierarchy filtering and page totals depend on the complete category. A bounded page API must move all those operations server-side before replacing the current path. Detail-list pagination must preserve own-wish, completed-experience and shared-event state even when a user's row is outside the first page. These changes require full-schema validation and remain pending.


## Category response pagination v179

Normal non-admin Library browsing supports 20-card response pages for wanting, done, active and alphabetical sorts. Visibility and all aggregates are validated first; the complete visible category is filtered for same-category parents and sorted before slicing. Total/page counts and all returned card fields match the complete-data path. This reduces transfer and client data size; it does **not** bound the database aggregation work, which still needs global counts for ranking.

Admin tools, personal scopes, friend/rating/award sorts, search, and geography/team or mixed place/club categories retain the complete-data path. Search explicitly waits for a full category read so off-page local matches are preserved. Page/sort request keys, abort/generation checks and response metadata validation prevent stale pages or incomplete totals from being displayed. Existing card markup, CSS classes and pagination navigation are retained.

Nine additional behavioral tests compare every page against the original client sorter, including Turkish titles, complete row data, hidden/cross-category parents, clamping, mixed category fallback, invalid parameters and fail-closed projections. Total: 48 application tests plus the prior SQL fixture. Production build and Next TypeScript check pass. A typecheck script now makes the existing Next-specific validation discoverable by Vercel; its previous check was skipped for lack of a matching script. Repository-wide lint has existing findings and remains separate from build success.

Deep database pagination and lazy detail people lists remain future work; detail ownership, completed-experience and shared-event state must be queried independently before lists can be truncated. Region alignment from iad1 to fra1 is pending the user's cost approval: official rates on 2026-10-12 are USD 0.128 vs 0.184 per CPU-hour and 0.0106 vs 0.0152 per GB-hour, before credits/taxes. No paid upgrade, Speed Insights Plus, retention change or rollback operation was performed.
