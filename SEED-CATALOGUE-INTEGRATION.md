# Seed Catalogue Integration Notes

## Database order

Run the migrations in this order:

1. `032_seed_lifecycle.sql`
2. `033_seed_journal_water_profile.sql`
3. `034_seed_catalogue_search.sql`
4. `035_seed_catalogue_flow_integration.sql`

Migration 035 is intentionally included even on a fresh installation. It also upgrades databases where the earlier version of migration 034 was already applied.

## Main routes

- `/seeds/new` selects between shared catalogue subjects and personal Seeds.
- `/seeds/explore` searches canonical subjects and aliases.
- `/seeds/subjects/[subjectId]` shows aggregate statistics and visible completion Experiences.
- `/admin/seed-catalogue` reviews pending subjects and merges duplicates.

## Expected test

1. Select **Read** from `/seeds/new`.
2. Search for `Suç & Ceza` and add it when no catalogue item exists.
3. Search again using `Suç ve Ceza` or `Suc ve Ceza`.
4. Confirm the same shared subject appears instead of a duplicate.
5. Plant the subject and add personal notes from the edit screen.
6. Complete the Seed with a reflection, then test Inspired, Save, comments and questions from the subject page.

## Build verification note

The source tree was syntax-checked with TypeScript 5.8.3. A full `npm run build` could not be executed in the artifact environment because its configured package registry did not contain required public packages. Run `npm ci` and `npm run build` in the normal project environment before deployment.

## 036 — Library identity ownership and direct deletion

Run this migration after 035:

```text
supabase/migrations/036_seed_library_identity_and_delete.sql
```

The ownership model is now explicit:

- A catalogue-linked Seed inherits its type, canonical title, creator and cover from the shared Seed Library.
- A member cannot change those identity fields from the personal Seed editor.
- Members can still edit their note, target date, visibility, links and journal.
- Deleting a personal Seed does not delete the shared Library subject.
- A Seed linked to an Intent cannot be hard-deleted because its lineage is preserved.
- Admins can edit canonical subject details and cover URLs from `/admin/seed-catalogue`.
- Catalogue edits automatically propagate to every linked personal Seed.

## 037 — Past experiences and direct admin creation

Run this migration after 036:

```text
supabase/migrations/037_seed_past_experience_and_admin_create.sql
```

### Past experience flow

A member can open a Library subject and choose **I've already done this** without first planting an active Seed.

- Read subjects use **I've read this**.
- Watch subjects use **I've watched this**.
- Visit subjects use **I've been here**.
- The resulting personal Seed is created directly with `status = completed` and `origin = retrospective`.
- Completion timing can be stored as an exact date, a year only, or unknown.
- A reflection and concise takeaway are optional.
- A retrospective Seed appears in Completed Seeds, not Active Seeds.
- Creating another retrospective record for the same member and subject opens the existing completed Seed instead of duplicating it.
- A completed past experience does not prevent the member from planting a new active Seed for a repeat experience later.

Route:

```text
/seeds/subjects/[subjectId]/past
```

### Admin-created Library subjects

The admin catalogue page now contains **Add a Seed to the Library**.

Admins can enter:

- Seed Type
- subject kind
- canonical title
- creator or author
- original title
- release year
- language code
- shared cover URL
- aliases and translated titles

The record is created as an active shared subject. The shared cover and identity are inherited by all personal Seeds linked to it.

### 037 test sequence

1. Open an existing Library subject while signed in.
2. Choose **I've already done this**.
3. Save it with an exact date, year only, or no remembered date.
4. Confirm it appears under Completed Seeds with a **Past experience** label.
5. Confirm it does not increase the active count.
6. Open `/admin/seed-catalogue`, expand **Add a Seed to the Library**, and add a subject with aliases.
7. Search the canonical title and an alias from `/seeds/explore`; both must resolve to the same subject.
