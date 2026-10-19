# Library context, watch availability and regional charts

Sources retrieved 19 October 2026. Verification timestamps remain audit metadata; the UI displays award years and chart periods, not a separate control date.

- Turkey streaming availability: [JustWatch Turkey](https://www.justwatch.com/tr), public GraphQL title/offer data with `country: TR`, `platform: WEB`. 828 catalog matches; subscription, advertising, free, rental and purchase offers remain distinct. Provider links go to the corresponding title. Multiple offers share one card. Empty verified offers are explicitly labelled instead of inventing a platform.
- Example: [Gibi](https://www.justwatch.com/tr/tv-sovu/gibi), IMDb `tt13675832`, [Exxen](https://www.exxen.com/tr/detail/serie/gibi/22396).
- 66 previously absent Turkish productions or coproductions added, with IMDb identities, release years, source URLs and successfully checked JustWatch covers. Existing matches use IMDb first, then unambiguous title/year. Existing canonical identities and all personal seed rows were preserved and checked transactionally.
- [YouTube Charts](https://charts.youtube.com/): weekly Top Artists ending **2026-10-15**, 100 entries each for TR, GB, DE, US, JP, KR, SA, IN, BR and FR. The exact official chart URLs and YouTube artist/channel identities are included in `library-context-v214.json`.
- [YouTube supported chart locations](https://support.google.com/youtube/answer/9014376?hl=en): mainland China and Qatar are not supported. No substitute country or fabricated ranking was added.

## Artist identity review

Official channel descriptions distinguish same-name artists. They must not be merged by stage name alone:

- [CRUSH, Turkish group](https://www.youtube.com/channel/UCdKIMZMJeZtLwitpv0O_U3Q) and [Crush, South Korean artist](https://www.youtube.com/channel/UCEU3spVQMmXrU0Nqhw00Gpg), also listed by [P Nation](https://www.pnation.com/artists/5).
- [Adam](https://www.youtube.com/channel/UC3uOwAgmquYz0bPNcvXILzg) and [ADAM, Jeddah rapper](https://www.youtube.com/channel/UCu_JvydpBO66BNHxX9s2mlQ).

Display disambiguators distinguish the latter artist of each pair. The targeted repair preserves the first artist's original card identity; the other artist receives a distinct card. Final validation: 1,000 regional entries, 100 distinct cards in each list, 555 newly added artists across all lists.

## Validation and deployment

- `library_shared_context_v214`: private server-derived context, consent, independent personal rating, sealed reciprocal rating and equal weighting per reviewer. Rollback SQL tests cover access denial, retry idempotency, unrelated-activity rejection, withdrawal and history preservation. No test invitations persist.
- Source data import dry-run and live transaction both verified personal seed history unchanged. Canonical targets are pinned during metadata enrichment; existing covers and personal records are not rewritten.
- Web and native TypeScript checks; web adapter tests; native category/cache, charts, shared payload and honours tests.
- Browser checks at 320px and 390px: Gibi/Exxen, multiple movie providers, regional chart dialog, no verification date or navigation overlap. Actual shared components tested with intercepted RPCs: experience rating 7 saved before peer rating 10. No real user was messaged.
- Planner statistics refreshed after import; full artist category read returned HTTP 200 in 6.4 seconds in the local integration check.
- Supabase security advisor: no new exposed shared helper; existing informational private-table RLS notices and pre-existing project-wide warnings remain outside this change. [Advisor documentation](https://supabase.com/docs/guides/database/database-linter).
