# Join Requests + Custom Activity Title Moderation

## Join Request lifecycle

The Join Requests screen is now action-oriented:

- **Needs your response** contains only pending requests attached to an active, non-expired Intent.
- **Your pending requests** contains only the current user's pending sent requests.
- Accepted, declined, withdrawn, planned, completed, cancelled and expired records move to **Request history**.
- Sent request cards show the host avatar, full name, username and profile link.
- Pending sent requests can be withdrawn from the page.
- Accepted/planned history records link to the Shared Plan or Activity Room instead of remaining in the active request queue.
- Custom Plan titles appear as the main label while the canonical Activity name remains visible as `Original Activity · …`.
- Timeline and Inbox pending-request counters ignore stale requests attached to non-active/expired Intents.

## Canonical vs custom Activity title

The Activity catalogue name remains the canonical identity. A Shared Plan may have a user-authored custom title, but the canonical Activity name is retained and displayed underneath when the names differ.

Examples:

- Custom title: `Trenle Eskişehir Gezisi`
- Original Activity: `City Walk`

Reputation and Activity identity continue to use the canonical Activity, not the user-authored presentation title.

## Reporting a custom title

Migration `041_join_request_lifecycle_and_custom_title_moderation.sql` adds custom-title moderation.

When an authenticated viewer reports a custom title:

1. The reported text is preserved privately for moderation.
2. Public/member presentation immediately falls back to the canonical Activity name.
3. The Activity, Plan, members, attendance and reputation are not changed.
4. The custom title is locked from editing while the report is pending.
5. The Primary Host / Co-host sees an `under review` notice in the Activity Room.

Report reasons:

- Offensive or abusive
- Hate or harassment
- Sexual content
- Spam or advertising
- Misleading
- Other

## Admin moderation

New route:

`/admin/moderation/titles`

Moderators can:

- **Restore custom title**: dismiss the report and restore the held title.
- **Remove custom title**: uphold the report and leave the canonical Activity name in place.

The moderation queue keeps reporter, host, canonical title, reported title snapshot, reason, details and resolution metadata.

## Migration

Run after migration 040:

`supabase/migrations/041_join_request_lifecycle_and_custom_title_moderation.sql`

No npm dependency changes are required.
