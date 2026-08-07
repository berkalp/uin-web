# UIN — Private Seed, Seed Library & Intent DNA Update

Migration: `042_private_seed_library_and_intent_dna.sql`

## Product model

### Private Seed
- Free-form personal thought/possibility.
- Always `Only me`.
- Never appears in Seed Library search, public profiles, social reaction surfaces or other users' Seed views.
- Can later connect to an existing Library subject or suggest a new shared subject.
- When connected, its original private title is retained owner-only as provenance.

### Library Seed
- A user's personal instance linked to one moderated canonical Seed Library subject.
- The Library owns type, canonical title, creator and shared cover.
- The user owns notes, links, journal, target date and profile visibility.
- A newly suggested Library subject remains private to the suggester while pending review.

### Moderated Seed Library
- Missing search results may be suggested with Seed Type, title, creator/context, year, suggested cover URL and reference URL.
- Suggestions are `pending`, not immediately public.
- Admin can approve, merge or reject them from `/admin/seed-catalogue`.
- Rejected suggestions do not destroy the user's Seed; it becomes an owner-only Private Seed.

### Reports
- An active shared Library subject can be reported from its Subject page.
- The first report immediately changes the canonical subject to `under_review`.
- Linked personal Seeds are temporarily forced to `Only me`; their previous visibility is backed up.
- The subject disappears from public Library/profile/Seed-detail surfaces while reviewed.
- Admin can restore, edit+restore, merge or remove the subject.
- Restoring/merging restores prior personal visibility. Removing preserves user history as Private Seeds.

### Intent DNA
- One Intent can grow from multiple Seeds.
- One Seed may also contribute to multiple Intents.
- Growing a Seed into an Intent now presents other active Seeds as optional DNA inputs.
- Activity/Intent detail shows `Intent DNA`.
- Private Seed text is never revealed to another viewer; it renders as `Private Seed` while preserving lineage.

## Migration order
Run migrations through 041 first, then run:

`supabase/migrations/042_private_seed_library_and_intent_dna.sql`

## No dependency changes
No new npm package is required.
