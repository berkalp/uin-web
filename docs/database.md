# UIN Database Design

Version 2.0

## Purpose

This document defines the target database architecture for UIN.

UIN is an Intent Network.

The database must preserve the following lifecycle:

```text
Person → Intent → Match / Request / Invitation → Plan → Activity → Experience
```

The database must not introduce alternate product paths that bypass Intent.

This document describes the target domain model. Existing database objects may require staged migrations before they fully match this design.

---

# Core Rules

1. Every account represents a person.

2. Only people create Intent.

3. No Organization account, Organization profile or Organization aggregate exists.

4. No Place account, Venue profile or Place-owned content exists.

5. Place is location metadata attached to Intent, Plan or Activity context.

6. No standalone Activity may be created directly.

7. Every shared Plan must derive from one or more Intent records.

8. Activity is the scheduled or executed lifecycle state of a Plan.

9. Match, request and invitation records must always relate to Intent.

10. Experience is created only after an Activity has taken place or its attendance outcome has been resolved.

11. Profile visibility never implies Intent visibility.

12. Participant identity is private by default.

13. Reputation is earned from verifiable behavior, not likes, followers or passive engagement.

14. All sensitive writes must pass through controlled database functions or server-side application services.

15. Row Level Security must be enabled on every user-facing table.

---

# Domain Language

## Person

A human account represented by `auth.users` and `profiles`.

A Person may:

- create Intent
- discover compatible Intent
- request participation
- invite another Person
- form or join a Plan
- participate in an Activity
- record an Experience
- earn trust signals

A Person may not become an Organization account or operate through an Organization identity.

---

## Intent

A declared direction, goal or desired real-world action.

Intent is the origin of all UIN activity.

Intent may be:

- tactical
- strategic
- telos

Intent may remain personal, become discoverable, match with another Intent, or contribute to a shared Plan.

---

## Match

A computed compatibility relationship.

A Match is not a social connection and is not a dating construct.

It exists only to help compatible Intent records become a shared Plan.

---

## Request

A Person asks to participate in another Person's discoverable Intent or forming Plan.

Requests require an explicit decision.

---

## Invitation

A Person invites another Person to participate in an Intent or Plan.

Invitations require an explicit decision.

---

## Plan

A coordination aggregate created from one or more Intent records.

A Plan begins in a forming state.

It contains:

- source Intent links
- members
- roles
- participant capacity
- budget commitments
- location metadata
- schedule draft
- planning conversation
- recruitment state
- lifecycle state

A Plan becomes an Activity when its schedule is finalized.

---

## Activity

The user-facing scheduled or executed state of a Plan.

In the target model, Activity does not need a separate independently created aggregate.

The canonical record remains the Plan:

```text
plan.status = forming     → Shared Plan
plan.status = planned     → Planned Activity
plan.status = completed   → Completed Activity
plan.status = cancelled   → Cancelled Activity
plan.status = expired     → Expired forming Plan
```

A future dedicated Activity table may be introduced only when operational requirements justify it. Such a record must:

- be created automatically from a Plan transition
- have a unique `plan_id`
- never be created directly
- preserve all source Intent links

---

## Experience

A person's post-Activity record.

Experience may include:

- attendance result
- private reflection
- optional public reflection
- memory or portfolio entry
- would-repeat signal
- trust or reputation events

Experience is not a public comment thread.

---

## Location

Location is metadata, not an account or social entity.

Location may include:

- country
- city
- district
- address
- latitude
- longitude
- Google Place ID
- map URL
- street-view URL
- human-readable meeting point

Location must not create a Place profile, Venue account or ownership model.

---

# Main Aggregates

## Person Aggregate

Includes:

- profiles
- profile_preferences
- friendships
- guardian_links
- managed profile controls
- reputation projections
- portfolio projections

---

## Intent Aggregate

Includes:

- intents
- intent_visibility
- intent_visibility_users
- intent_lifecycle_events
- intent_requests
- intent_invitations
- intent_matches

---

## Plan Aggregate

Includes:

- plans
- plan_intents
- plan_members
- plan_budget_commitments
- plan_messages
- plan_message_reads
- plan_lifecycle_events
- plan_invitations
- plan_join_requests

---

## Experience Aggregate

Includes:

- attendance_records
- experiences
- reflections
- reputation_events
- portfolio projections

---

## Safety and Governance Aggregate

Includes:

- reports
- account_restrictions
- moderation_actions
- audit_events
- notification deliveries

---

# Database Phases

## Phase 1 — Core Product

- profiles
- profile_preferences
- friendships
- activity_categories
- activity_types
- locations
- intents
- intent_visibility
- intent_visibility_users
- intent_lifecycle_events
- intent_matches
- intent_requests
- intent_invitations
- plans
- plan_intents
- plan_members
- plan_messages
- plan_message_reads
- plan_lifecycle_events
- attendance_records
- experiences
- reputation_events
- notifications
- reports
- account_restrictions
- audit_events

---

## Phase 2 — Family, Discovery and Portfolio

- guardian_links
- managed_profile_invitations
- saved_intents
- followed_intents
- life_themes
- portfolio_projections
- recommendation_feedback
- search_documents

---

## Phase 3 — Intelligence and Scale

- ai_embeddings
- recommendations
- analytics_events
- moderation_signals
- notification_deliveries
- data_retention_jobs
- projection_rebuild_jobs

---

# Identity and Person Tables

## profiles

Represents the product identity of a Person.

Supabase `auth.users` handles authentication.

`profiles` handles UIN identity.

Fields:

- id uuid primary key references auth.users(id)
- username text unique not null
- full_name text nullable
- avatar_url text nullable
- cover_url text nullable
- bio text nullable
- city text nullable
- country text nullable
- birth_date date nullable
- is_managed_minor boolean not null default false
- onboarding_completed boolean not null default false
- account_status text not null default 'active'
- created_at timestamptz not null
- updated_at timestamptz not null
- deleted_at timestamptz nullable

Account Statuses:

- active
- restricted
- suspended
- deleted

Rules:

- One authenticated user owns one profile.
- Every profile represents a Person.
- Profile visibility does not imply Intent visibility.
- Profile is an Intent biography, not a content feed.
- Username changes must preserve route safety and audit history.
- Deleted profiles must not leave orphaned Intent, Plan or audit records.

Recommended Indexes:

- unique lower(username)
- account_status
- created_at

---

## profile_preferences

Stores personal product preferences that do not belong in the public profile.

Fields:

- profile_id uuid primary key references profiles(id)
- timezone text not null default 'Europe/Istanbul'
- locale text not null default 'en'
- default_city text nullable
- default_country text nullable
- notification_preferences jsonb not null default '{}'
- privacy_preferences jsonb not null default '{}'
- accessibility_preferences jsonb not null default '{}'
- created_at timestamptz not null
- updated_at timestamptz not null

Rules:

- Preferences are private.
- Preferences must not be used to weaken explicit Intent visibility.
- Notification preferences may reduce delivery but may not suppress legally required safety notices.

---

## friendships

Represents a mutual trust relationship between two people.

Fields:

- id uuid primary key
- requester_id uuid not null references profiles(id)
- addressee_id uuid not null references profiles(id)
- status text not null
- level text not null default 'friend'
- created_from_plan_id uuid nullable references plans(id)
- created_at timestamptz not null
- updated_at timestamptz not null

Statuses:

- pending
- accepted
- declined
- blocked

Levels:

- friend
- close_friend
- muted
- blocked

Rules:

- A pair of users may have only one active friendship record.
- A user may not send a friendship request to themselves.
- Friendship supports visibility, invitations and trust.
- Friendship must not create follower-count status.
- Blocking must override all friendship and visibility permissions.

Recommended Constraints:

- requester_id <> addressee_id
- unique normalized user pair
- blocked state overrides accepted state

---

# Family and Managed Profile Tables

## guardian_links

Represents an approved adult relationship to a managed minor profile.

Fields:

- id uuid primary key
- child_user_id uuid not null references profiles(id)
- guardian_user_id uuid not null references profiles(id)
- guardian_role text not null
- relationship text not null
- status text not null
- can_manage_profile boolean not null default false
- can_manage_activities boolean not null default false
- invited_by_user_id uuid nullable references profiles(id)
- accepted_at timestamptz nullable
- revoked_at timestamptz nullable
- created_at timestamptz not null
- updated_at timestamptz not null

Guardian Roles:

- primary_guardian
- guardian

Relationships:

- parent
- legal_guardian

Statuses:

- pending
- accepted
- declined
- revoked

Rules:

- A managed minor must have at least one accepted Primary Guardian before Activity participation.
- A child profile may not manage its own guardian permissions.
- Only authorized guardians may approve participation decisions.
- Guardian permission changes must create audit events.
- Managed minor policy must be enforced by RLS and controlled functions, not UI alone.

---

## managed_profile_invitations

Represents Activity participation invitations requiring guardian review.

Fields:

- id uuid primary key
- child_user_id uuid not null references profiles(id)
- source_intent_id uuid not null references intents(id)
- plan_id uuid nullable references plans(id)
- invited_by_user_id uuid not null references profiles(id)
- message text nullable
- status text not null
- supervising_guardian_user_id uuid nullable references profiles(id)
- responded_by_guardian_user_id uuid nullable references profiles(id)
- expires_at timestamptz not null
- responded_at timestamptz nullable
- created_at timestamptz not null
- updated_at timestamptz not null

Statuses:

- pending
- accepted
- declined
- expired
- revoked

Rules:

- Acceptance must identify the responding guardian.
- Accepted participation may identify a supervising guardian.
- Expired or revoked invitations may not create active Plan membership.
- A child may not approve their own invitation when guardian approval is required.

---

# Taxonomy and Location Tables

## activity_categories

Represents broad Intent and Activity categories.

Fields:

- id uuid primary key
- name text not null
- slug text unique not null
- parent_id uuid nullable references activity_categories(id)
- is_active boolean not null default true
- sort_order int not null default 0
- created_at timestamptz not null
- updated_at timestamptz not null

Examples:

- sports
- cultural_event
- education
- volunteering
- travel
- family
- entrepreneurship

Rules:

- Categories are taxonomy, not user-generated posts.
- Category deletion should use `is_active = false`.
- Historical records must retain category references.

---

## activity_types

Represents selectable real-world activity definitions.

Examples:

- walking
- running
- basketball
- theatre
- concert
- workshop
- volunteering
- museum_visit

Fields:

- id uuid primary key
- category_id uuid not null references activity_categories(id)
- name text not null
- slug text unique not null
- description text nullable
- is_active boolean not null default true
- created_at timestamptz not null
- updated_at timestamptz not null

Rules:

- `activity_types` is a catalog.
- It is not a scheduled Activity.
- It has no host, participant, owner or independent public page.
- Intent and Plan may reference the same Activity Type.
- Historical records must remain valid if a type becomes inactive.

Migration Note:

- A legacy table named `activities` may currently function as this catalog.
- The target domain name is `activity_types`.
- Renaming should occur through a staged migration with compatibility views or updated queries.

---

## locations

Represents normalized location metadata.

Fields:

- id uuid primary key
- country_code text nullable
- country_name text nullable
- city text nullable
- district text nullable
- neighborhood text nullable
- address_text text nullable
- latitude numeric nullable
- longitude numeric nullable
- google_place_id text nullable
- map_url text nullable
- street_view_url text nullable
- place_name text nullable
- source text not null default 'manual'
- created_at timestamptz not null
- updated_at timestamptz not null

Sources:

- manual
- google_places
- imported
- system

Rules:

- Location has no account identity.
- Location has no owner.
- Location has no membership model.
- Location must not publish Intent or host Activity.
- A Plan may override an Intent location with a more precise meeting point.
- Latitude and longitude may be hidden from unauthorized users until participation is approved.
- External provider IDs must not be treated as permanent human-readable addresses.

Recommended Indexes:

- google_place_id
- city, district
- geospatial index when PostGIS is introduced

---

# Intent Tables

## intents

The central table of UIN.

Fields:

- id uuid primary key
- user_id uuid not null references profiles(id)
- parent_intent_id uuid nullable references intents(id)
- activity_type_id uuid not null references activity_types(id)
- location_id uuid nullable references locations(id)
- intent_type text not null
- title text not null
- description text nullable
- people_preference text nullable
- recurrence text not null default 'once'
- start_date date not null
- end_date date not null
- budget numeric nullable
- max_participants int nullable
- visibility text not null
- status text not null
- recruitment_status text not null
- matching_status text not null
- planned_at timestamptz nullable
- completed_at timestamptz nullable
- cancelled_at timestamptz nullable
- expired_at timestamptz nullable
- copied_from_intent_id uuid nullable references intents(id)
- created_at timestamptz not null
- updated_at timestamptz not null
- deleted_at timestamptz nullable

Intent Types:

- tactical
- strategic
- telos

Intent Statuses:

- draft
- active
- planned
- completed
- cancelled
- archived

Recruitment Statuses:

- open
- full
- closed

Matching Statuses:

- open
- paused
- matched
- closed

Rules:

- Only a Person may own Intent.
- `user_id` must always reference a Person profile.
- An Intent may exist without a Match or Plan.
- A Plan may not exist without at least one source Intent.
- Intent date range defines availability, not the final Activity schedule.
- Time of day belongs to the Plan schedule, not the early Intent.
- Telos Intent may omit Activity execution and remain directional.
- Tactical and Strategic Intent may contribute to Plans.
- An Intent linked to a finalized Plan must close or pause new matching according to product policy.
- Expiration is distinct from cancellation.
- Intent uses soft deletion.

Recommended Constraints:

- end_date >= start_date
- budget >= 0 when not null
- max_participants > 0 when not null
- copied_from_intent_id <> id
- parent_intent_id <> id

Recommended Indexes:

- user_id, status
- activity_type_id, location_id
- matching_status, recruitment_status
- start_date, end_date
- visibility
- created_at desc

---

## intent_visibility

Stores the visibility policy for an Intent when policy requires more detail than the canonical `intents.visibility` field.

Fields:

- intent_id uuid primary key references intents(id)
- visibility_type text not null
- allow_join_requests boolean not null default true
- reveal_exact_location boolean not null default false
- created_at timestamptz not null
- updated_at timestamptz not null

Visibility Types:

- public
- friends_only
- close_friends_only
- invite_only
- selected_users
- exclude_selected_users
- private_draft

Rules:

- Every Intent owns its visibility.
- Profile visibility does not override Intent visibility.
- Block relationships override all include rules.
- Exact location disclosure may be stricter than Intent discovery visibility.

---

## intent_visibility_users

Stores explicit user inclusion or exclusion rules.

Fields:

- id uuid primary key
- intent_id uuid not null references intents(id)
- user_id uuid not null references profiles(id)
- rule text not null
- created_at timestamptz not null

Rules:

- include
- exclude

Constraints:

- unique intent_id, user_id
- rule in include, exclude

---

## intent_lifecycle_events

Append-only history of meaningful Intent state changes.

Fields:

- id uuid primary key
- intent_id uuid not null references intents(id)
- actor_user_id uuid nullable references profiles(id)
- event_type text not null
- from_status text nullable
- to_status text nullable
- metadata jsonb not null default '{}'
- created_at timestamptz not null

Event Types:

- created
- published
- matching_opened
- matching_paused
- request_received
- invitation_sent
- matched
- linked_to_plan
- recruitment_closed
- planned
- completed
- expired
- archived
- cancelled
- copied

Rules:

- Lifecycle events are append-only.
- Users do not insert lifecycle events directly.
- Controlled actions create lifecycle events in the same transaction as state changes.
- Metadata must not duplicate secrets or unrestricted personal data.

Recommended Indexes:

- intent_id, created_at
- actor_user_id, created_at
- event_type, created_at

---

## intent_matches

Represents computed compatibility between Intent records.

Fields:

- id uuid primary key
- source_intent_id uuid not null references intents(id)
- candidate_intent_id uuid not null references intents(id)
- score numeric not null
- status text not null
- reason jsonb not null default '{}'
- algorithm_version text not null
- expires_at timestamptz nullable
- created_at timestamptz not null
- updated_at timestamptz not null

Statuses:

- active
- accepted
- dismissed
- expired
- invalidated

Rules:

- A Match must connect two different Intent records.
- Match visibility must respect both Intent visibility policies.
- Match score is not public reputation.
- Match results must be invalidated when key Intent fields change.
- A Match does not itself create a Plan.

Constraints:

- source_intent_id <> candidate_intent_id
- unique normalized Intent pair per active algorithm version
- score between 0 and 1, or a documented equivalent range

---

## intent_requests

Represents a Person requesting to connect with or participate through an Intent.

Fields:

- id uuid primary key
- requester_id uuid not null references profiles(id)
- receiver_id uuid not null references profiles(id)
- source_intent_id uuid not null references intents(id)
- target_intent_id uuid not null references intents(id)
- status text not null
- message text nullable
- responded_at timestamptz nullable
- created_at timestamptz not null
- updated_at timestamptz not null

Statuses:

- pending
- accepted
- rejected
- withdrawn
- expired
- cancelled

Rules:

- Requester and receiver must be different people.
- Requester must own `source_intent_id`.
- Receiver must own `target_intent_id`.
- Both Intent records must be compatible with visibility and lifecycle policy.
- Accepted requests may create or update a Plan through a controlled transaction.
- A pending duplicate request for the same Intent pair is not allowed.

---

## intent_invitations

Represents a direct invitation from one Person to another Person.

Fields:

- id uuid primary key
- inviter_user_id uuid not null references profiles(id)
- invitee_user_id uuid not null references profiles(id)
- source_intent_id uuid not null references intents(id)
- plan_id uuid nullable references plans(id)
- message text nullable
- status text not null
- expires_at timestamptz nullable
- responded_at timestamptz nullable
- created_at timestamptz not null
- updated_at timestamptz not null

Statuses:

- pending
- accepted
- declined
- withdrawn
- expired
- revoked

Rules:

- Invitation must originate from a Person.
- Invitation must reference an Intent.
- Invitation may reference an existing forming Plan.
- Acceptance must not bypass capacity, restriction or visibility checks.
- Managed minors require guardian policy.

---

# Plan and Activity Lifecycle Tables

## plans

The coordination aggregate that becomes the user-facing Activity.

Fields:

- id uuid primary key
- host_user_id uuid not null references profiles(id)
- activity_type_id uuid not null references activity_types(id)
- location_id uuid nullable references locations(id)
- title text not null
- window_start date not null
- window_end date not null
- scheduled_start timestamptz nullable
- scheduled_end timestamptz nullable
- timezone text not null
- meeting_point text nullable
- schedule_notes text nullable
- budget numeric nullable
- target_budget numeric nullable
- max_participants int nullable
- status text not null
- recruitment_status text not null
- visibility text not null
- notes text nullable
- planned_at timestamptz nullable
- completed_at timestamptz nullable
- cancelled_at timestamptz nullable
- expired_at timestamptz nullable
- created_at timestamptz not null
- updated_at timestamptz not null
- deleted_at timestamptz nullable

Plan Statuses:

- forming
- planned
- completed
- cancelled
- expired

Recruitment Statuses:

- open
- full
- closed

Rules:

- A Plan must have at least one active `plan_intents` link.
- `host_user_id` must be a Person.
- A Plan may not be created directly from an empty form.
- The host must own or be authorized for the host-source Intent.
- `forming` means coordination is still active.
- `planned` means schedule and meeting point are finalized.
- `completed` means attendance review is resolved.
- `cancelled` is an explicit decision.
- `expired` means the forming window ended without final scheduling.
- Finalizing a Plan must close inappropriate matching and recruitment paths atomically.
- Planned Activity data must remain immutable except through controlled rescheduling or cancellation actions.
- The Plan is soft-deleted.

Required Transition Invariants:

### forming → planned

Requires:

- at least one active source Intent
- active host membership
- scheduled_start
- scheduled_end
- timezone
- meeting_point
- scheduled_end > scheduled_start
- scheduled dates consistent with product policy
- no blocking restriction

### planned → completed

Requires:

- scheduled_start has passed; a Host or Co-host may record an early real-world finish without changing the confirmed schedule
- attendance review completed or explicitly waived by policy
- completion actor authorized as host or co-host

### forming → expired

Requires:

- window_end has passed
- no finalized schedule
- status is still forming

Recommended Indexes:

- host_user_id, status
- status, recruitment_status
- scheduled_start
- window_end
- activity_type_id, location_id
- created_at desc

---

## plan_intents

Links one or more source Intent records to a Plan.

Fields:

- id uuid primary key
- plan_id uuid not null references plans(id)
- intent_id uuid not null references intents(id)
- relationship text not null
- status text not null
- linked_by_user_id uuid nullable references profiles(id)
- created_at timestamptz not null
- detached_at timestamptz nullable

Relationships:

- host_source
- participant_source

Statuses:

- active
- detached

Rules:

- Every Plan requires exactly one active host-source Intent.
- A Plan may have multiple participant-source Intent records.
- An Intent may not be actively linked to conflicting finalized Plans.
- Detaching a source Intent must preserve history.
- Deleting a Plan must not delete its source Intent records.

Constraints:

- unique plan_id, intent_id while active
- one active host_source per plan

---

## plan_members

Represents people participating in a Plan.

Fields:

- id uuid primary key
- plan_id uuid not null references plans(id)
- user_id uuid not null references profiles(id)
- source_intent_id uuid nullable references intents(id)
- role text not null
- status text not null
- attendance_status text not null default 'pending'
- budget_commitment numeric nullable
- joined_at timestamptz not null
- withdrawn_at timestamptz nullable
- removed_at timestamptz nullable
- created_at timestamptz not null
- updated_at timestamptz not null

Roles:

- host
- co_host
- participant

Statuses:

- active
- withdrawn
- removed

Attendance Statuses:

- pending
- attended
- no_show
- cancelled

Rules:

- A Person may have only one active membership per Plan.
- The host must have an active host membership.
- Active participant count must respect capacity.
- Host is not counted twice as a participant.
- Removing or withdrawing a member must update committed budget totals.
- Membership changes must create lifecycle and conversation system events.
- Managed minor membership requires guardian approval.

Recommended Constraints:

- budget_commitment >= 0 when not null
- one active membership per plan_id, user_id
- one active host role per Plan

---

## plan_budget_commitments

Optional normalized ledger for budget commitments and adjustments.

Use this table when a single mutable value on `plan_members` is not sufficient for auditability.

Fields:

- id uuid primary key
- plan_id uuid not null references plans(id)
- user_id uuid not null references profiles(id)
- amount numeric not null
- event_type text not null
- source_member_id uuid nullable references plan_members(id)
- created_by_user_id uuid nullable references profiles(id)
- metadata jsonb not null default '{}'
- created_at timestamptz not null

Event Types:

- committed
- increased
- decreased
- withdrawn
- removed
- corrected

Rules:

- Ledger rows are append-only.
- Current committed budget is derived from valid ledger entries.
- Direct editing of historical entries is not allowed.
- Corrections create compensating entries.

---

## plan_messages

Stores Planning Room and Activity Room conversation.

Fields:

- id uuid primary key
- plan_id uuid not null references plans(id)
- sender_user_id uuid nullable references profiles(id)
- message_type text not null
- body text not null
- system_event text nullable
- metadata jsonb not null default '{}'
- created_at timestamptz not null
- edited_at timestamptz nullable
- deleted_at timestamptz nullable

Message Types:

- text
- system

Rules:

- Only active authorized Plan members may read the room.
- Only active authorized Plan members may send text messages.
- System messages are inserted by controlled actions.
- A Plan room continues after final scheduling as the Activity Room.
- Soft-deleted text must preserve moderation and audit requirements.
- Room access ends according to retention and safety policy, not merely UI navigation.

Recommended Indexes:

- plan_id, created_at
- sender_user_id, created_at

---

## plan_message_reads

Tracks per-user conversation read state.

Fields:

- plan_id uuid not null references plans(id)
- user_id uuid not null references profiles(id)
- last_read_message_id uuid nullable references plan_messages(id)
- last_read_at timestamptz nullable
- updated_at timestamptz not null

Primary Key:

- plan_id, user_id

Rules:

- Read state is private.
- Unread counts are projections and may be recalculated.
- A user cannot create read state for a Plan they cannot access.

---

## plan_lifecycle_events

Append-only history of Plan and Activity transitions.

Fields:

- id uuid primary key
- plan_id uuid not null references plans(id)
- actor_user_id uuid nullable references profiles(id)
- event_type text not null
- from_status text nullable
- to_status text nullable
- metadata jsonb not null default '{}'
- created_at timestamptz not null

Event Types:

- created
- member_joined
- member_withdrew
- member_removed
- recruitment_opened
- recruitment_closed
- capacity_reached
- schedule_updated
- finalized
- rescheduled
- cancelled
- expired
- attendance_review_started
- attendance_recorded
- completed

Rules:

- Events are append-only.
- State transition and event insertion occur in one transaction.
- Events may generate notifications and system messages.
- User-facing history is derived from safe event projections.

---

# Experience and Trust Tables

## attendance_records

Stores final attendance outcome for each Plan member.

Fields:

- id uuid primary key
- plan_id uuid not null references plans(id)
- user_id uuid not null references profiles(id)
- plan_member_id uuid not null references plan_members(id)
- status text not null
- recorded_by_user_id uuid nullable references profiles(id)
- recorded_at timestamptz not null
- metadata jsonb not null default '{}'

Statuses:

- attended
- no_show
- cancelled
- unresolved

Rules:

- One final attendance record per Plan member.
- Attendance may be recorded only by an authorized host, co-host or controlled system action.
- Participants may dispute attendance through a separate safety workflow.
- Attendance affects reputation only after the Activity is completed.
- Managed minor attendance remains private to authorized users.

---

## experiences

Represents a Person's post-Activity portfolio record.

Fields:

- id uuid primary key
- plan_id uuid not null references plans(id)
- user_id uuid not null references profiles(id)
- attendance_record_id uuid nullable references attendance_records(id)
- visibility text not null default 'private'
- summary text nullable
- would_repeat boolean nullable
- integrated_at timestamptz nullable
- created_at timestamptz not null
- updated_at timestamptz not null
- deleted_at timestamptz nullable

Visibility:

- private
- participants_only
- friends_only
- public

Rules:

- One Experience per user per completed Plan.
- Experience may be created only after completion.
- Experience may be integrated into the user's portfolio.
- Experience does not expose other participants without permission.
- Experience uses soft deletion.

---

## reflections

Stores post-Activity reflection details.

Fields:

- id uuid primary key
- experience_id uuid not null references experiences(id)
- user_id uuid not null references profiles(id)
- rating int nullable
- mood text nullable
- public_text text nullable
- private_notes text nullable
- would_repeat boolean nullable
- created_at timestamptz not null
- updated_at timestamptz not null
- deleted_at timestamptz nullable

Rules:

- Reflection belongs to an Experience.
- Private notes remain private.
- Public reflection is optional.
- Reflection is not a public comment system.
- Rating range must be validated.
- Reflection may support recommendations and life-theme projections.

---

## reputation_events

Append-only trust events derived from verified behavior.

Fields:

- id uuid primary key
- user_id uuid not null references profiles(id)
- source_plan_id uuid nullable references plans(id)
- source_intent_id uuid nullable references intents(id)
- event_type text not null
- value numeric not null
- metadata jsonb not null default '{}'
- created_at timestamptz not null

Event Types:

- activity_completed
- attended
- no_show
- cancelled_late
- reliable_host
- helpful_participant
- repeat_participant
- verified_identity
- safety_violation
- correction

Rules:

- Users may not insert reputation events directly.
- Reputation is not likes, reactions or follower count.
- Every event must have an auditable source.
- Corrections use compensating events.
- Public trust score is a projection, not raw event disclosure.
- Sensitive moderation details must not appear in public metadata.

---

# Portfolio and Discovery Tables

## saved_intents

Represents private Intent bookmarking.

Fields:

- id uuid primary key
- user_id uuid not null references profiles(id)
- intent_id uuid not null references intents(id)
- created_at timestamptz not null

Rules:

- Saving is not liking.
- Saved Intent is private.
- Saving does not grant future access if visibility changes.
- Duplicate saves are not allowed.

---

## followed_intents

Represents following a long-term or public Intent journey.

Fields:

- id uuid primary key
- user_id uuid not null references profiles(id)
- intent_id uuid not null references intents(id)
- created_at timestamptz not null

Rules:

- Users follow Intent, not people.
- Follow access depends on current Intent visibility.
- Follow counts must not become social status metrics.
- Updates must respect notification preferences.

---

## life_themes

Represents derived themes from Intent, Plan and Experience history.

Fields:

- id uuid primary key
- user_id uuid not null references profiles(id)
- theme text not null
- score numeric not null
- source_version text not null
- calculated_at timestamptz not null
- updated_at timestamptz not null

Rules:

- Life themes are derived, not selected as badges.
- Themes may be recalculated.
- Private Intent must not leak through public theme labels.
- Model and algorithm version must be recorded.

---

## portfolio_projections

Stores rebuildable portfolio summaries.

Fields:

- user_id uuid primary key references profiles(id)
- tactical_intent_count int not null default 0
- strategic_intent_count int not null default 0
- telos_intent_count int not null default 0
- planned_activity_count int not null default 0
- completed_activity_count int not null default 0
- public_experience_count int not null default 0
- projection jsonb not null default '{}'
- calculated_at timestamptz not null

Rules:

- Projection is derived and rebuildable.
- Projection is not a source of truth.
- Private source records must not appear in public projection output.
- Projection jobs must be idempotent.

---

# Notification Tables

## notifications

Stores in-product notifications.

Fields:

- id uuid primary key
- user_id uuid not null references profiles(id)
- type text not null
- title text not null
- body text not null
- related_intent_id uuid nullable references intents(id)
- related_plan_id uuid nullable references plans(id)
- related_user_id uuid nullable references profiles(id)
- read_at timestamptz nullable
- created_at timestamptz not null
- expires_at timestamptz nullable

Allowed Notification Types:

- intent_match_found
- intent_request_received
- intent_request_accepted
- intent_invitation_received
- plan_invitation_received
- plan_member_joined
- plan_member_withdrew
- plan_schedule_updated
- activity_finalized
- activity_reminder
- activity_completion_required
- activity_completed
- reflection_requested
- guardian_action_required
- restriction_notice

Disallowed Notification Types:

- user_posted
- user_liked
- user_viewed_profile
- random_engagement_prompt
- inactivity_guilt_prompt

Rules:

- Notifications must relate to Intent, Plan, Activity, Experience, guardian action or safety.
- Notifications must not optimize for compulsive engagement.
- Notification visibility must match access to the related resource.
- Deleted or inaccessible resources must not leak through notification bodies.

---

## notification_deliveries

Optional delivery log for email, push or other channels.

Fields:

- id uuid primary key
- notification_id uuid not null references notifications(id)
- channel text not null
- status text not null
- provider_message_id text nullable
- attempted_at timestamptz nullable
- delivered_at timestamptz nullable
- failed_at timestamptz nullable
- error_code text nullable
- created_at timestamptz not null

Rules:

- Delivery log is operational data.
- Provider payloads must not store unnecessary personal data.
- Retry logic must be bounded and idempotent.

---

# Safety, Moderation and Audit Tables

## reports

Represents a safety or moderation report.

Fields:

- id uuid primary key
- reporter_user_id uuid not null references profiles(id)
- target_type text not null
- target_id uuid not null
- reason text not null
- details text nullable
- status text not null
- assigned_admin_user_id uuid nullable references profiles(id)
- resolved_at timestamptz nullable
- created_at timestamptz not null
- updated_at timestamptz not null

Target Types:

- profile
- intent
- plan
- message
- experience

Statuses:

- open
- under_review
- resolved
- dismissed

Rules:

- Reporter identity is not exposed to the reported user.
- Report target must exist or have an auditable tombstone.
- Resolution must create moderation and audit events.
- Reports must not directly mutate reputation without review.

---

## account_restrictions

Represents temporary or permanent product restrictions.

Fields:

- id uuid primary key
- user_id uuid not null references profiles(id)
- restriction_type text not null
- status text not null
- reason_code text not null
- starts_at timestamptz not null
- ends_at timestamptz nullable
- created_by_admin_user_id uuid nullable references profiles(id)
- lifted_by_admin_user_id uuid nullable references profiles(id)
- created_at timestamptz not null
- updated_at timestamptz not null

Restriction Types:

- read_only
- no_new_intents
- no_requests
- no_invitations
- no_plan_creation
- no_messaging
- suspended

Rules:

- Active restrictions must be checked server-side.
- UI hiding is not enforcement.
- Restriction changes must be audited.
- Expired restrictions must not remain effective.

---

## moderation_actions

Represents an administrative decision.

Fields:

- id uuid primary key
- report_id uuid nullable references reports(id)
- target_type text not null
- target_id uuid not null
- action_type text not null
- reason text not null
- admin_user_id uuid not null references profiles(id)
- metadata jsonb not null default '{}'
- created_at timestamptz not null

Action Types:

- warn
- hide
- restore
- restrict
- suspend
- remove_content
- dismiss_report

Rules:

- Moderation actions are append-only.
- Reversal creates a new action.
- Public records must not expose internal moderation notes.

---

## audit_events

Append-only security and administrative audit log.

Fields:

- id uuid primary key
- actor_user_id uuid nullable references profiles(id)
- actor_type text not null
- action text not null
- target_type text nullable
- target_id uuid nullable
- request_id text nullable
- ip_hash text nullable
- user_agent_hash text nullable
- metadata jsonb not null default '{}'
- created_at timestamptz not null

Actor Types:

- user
- admin
- system
- service

Rules:

- Audit events are append-only.
- Audit metadata must avoid raw secrets and unnecessary personal data.
- Administrative writes require audit events.
- Sensitive user actions should carry correlation or request IDs.
- Retention must follow legal and security policy.

---

# Search, AI and Analytics Tables

## search_documents

Represents a rebuildable search projection.

Fields:

- id uuid primary key
- entity_type text not null
- entity_id uuid not null
- searchable_text text not null
- visibility_scope jsonb not null
- metadata jsonb not null default '{}'
- updated_at timestamptz not null

Entity Types:

- intent
- profile
- public_experience

Rules:

- Location is searchable only as Intent or Plan metadata.
- No Organization or Place entity type exists.
- Search results must respect current visibility.
- Private Intent must never enter a public search document.
- Projection must be rebuildable.

---

## ai_embeddings

Stores vector representations for permitted entities.

Fields:

- id uuid primary key
- entity_type text not null
- entity_id uuid not null
- embedding vector not null
- model_name text not null
- model_version text not null
- visibility_scope jsonb not null
- metadata jsonb not null default '{}'
- created_at timestamptz not null
- updated_at timestamptz not null

Entity Types:

- intent
- profile
- experience
- reflection

Rules:

- Embeddings inherit source visibility.
- Private reflections may not be used for public recommendations.
- Model and version must be recorded.
- Deletion or visibility changes must invalidate affected embeddings.
- Raw sensitive text should not be duplicated in metadata.

---

## recommendations

Stores generated recommendations.

Fields:

- id uuid primary key
- user_id uuid not null references profiles(id)
- recommended_intent_id uuid nullable references intents(id)
- recommendation_type text not null
- score numeric not null
- reason jsonb not null default '{}'
- model_version text not null
- created_at timestamptz not null
- expires_at timestamptz nullable
- dismissed_at timestamptz nullable

Recommendation Types:

- compatible_intent
- inspiring_intent
- tactical_suggestion
- strategic_suggestion
- telos_alignment
- friend_visible_intent

Rules:

- Recommendations are Intent-centered.
- Recommendations must respect visibility at read time.
- Recommendation feeds must not become passive infinite-scroll content.
- Dismissal feedback must not silently change privacy settings.

---

## analytics_events

Represents privacy-aware product analytics.

Fields:

- id uuid primary key
- user_id uuid nullable references profiles(id)
- event_type text not null
- entity_type text nullable
- entity_id uuid nullable
- session_id text nullable
- metadata jsonb not null default '{}'
- created_at timestamptz not null

Rules:

- Analytics exists for product quality and safety.
- Analytics must not optimize for addiction.
- Sensitive text must not be copied into analytics metadata.
- User identifiers should be minimized where aggregation is sufficient.
- Retention periods must be documented.

---

# Portfolio Model

Intent Portfolio is a domain projection.

It is derived from:

- intents
- plans
- experiences
- reflections
- reputation_events
- life_themes

User-facing Portfolio may include:

- Past Intent
- Active Intent
- Future Intent
- Tactical Intent
- Strategic Intent
- Telos Intent
- Planned Activities
- Completed Activities
- Public Experiences
- Life Themes

Internal integration means:

- a completed or experienced lifecycle record has become part of the user's portfolio projection

Portfolio data must remain rebuildable from source records.

---

# Privacy Model

## Profile Privacy

A visible profile may show:

- basic profile information
- permitted trust summary
- public portfolio summary
- public Intent
- public planned Activities
- public Experiences

A visible profile must not automatically expose private Intent, exact meeting points, private reflections or participant identities.

---

## Intent Privacy

Every Intent owns its own visibility policy.

Supported visibility:

- public
- friends_only
- close_friends_only
- invite_only
- selected_users
- exclude_selected_users
- private_draft

Access must be recalculated at read time.

Cached search or recommendation projections must not override current visibility.

---

## Plan and Activity Privacy

Plan access is based on:

- active membership
- host or co-host authority
- invitation or request state
- public discovery policy
- guardian policy
- account restrictions
- block relationships

Exact meeting point and room conversation should normally be visible only to authorized members.

Participant identity is private by default.

An Activity may be publicly visible without exposing member names.

---

## Experience Privacy

Experience visibility belongs to the Person who created it.

One Person may not expose another participant's identity without permission.

Private reflections remain private even when the Experience summary is public.

---

## Managed Minor Privacy

Managed minor data requires stricter access.

Public surfaces must not expose:

- exact meeting points
- guardian private details
- invitation decision metadata
- attendance disputes
- private reflections
- unnecessary age information

Guardian approval must be enforced in database policy and controlled functions.

---

# Row Level Security Principles

Every user-facing table must enable RLS.

## Users May Read

- their own private profile data
- public profile data
- their own Intent
- Intent visible through explicit policy
- Intent they are invited to
- Plan they are authorized to access
- Activity context derived from an authorized Plan
- their own Experience and reflections
- public Experiences
- notifications addressed to them
- managed minor data they are authorized to manage
- administrative data only when they have explicit admin authority

## Users May Write

- their own profile fields permitted by policy
- their own Intent through validated actions
- participation requests
- invitations they are authorized to send
- their own Plan messages when membership allows
- their own reflections
- friendship requests
- saved or followed Intent
- notification read state
- guardian decisions when authorized

## Users May Not Write Directly

- another person's profile
- another person's Intent
- Plan lifecycle status
- attendance for unauthorized users
- reputation events
- lifecycle events
- moderation actions
- account restrictions
- audit events
- recommendation scores
- portfolio projections

These writes must use controlled functions or trusted server-side services.

---

# Controlled Database Actions

High-risk lifecycle operations should be performed through transactional functions or equivalent server-side services.

Examples:

- accept_intent_request
- reject_intent_request
- withdraw_intent_request
- accept_intent_invitation
- create_plan_from_intents
- attach_intent_to_plan
- detach_intent_from_plan
- add_plan_member
- remove_plan_member
- withdraw_from_plan
- update_plan_schedule
- finalize_plan
- reopen_plan_recruitment
- close_plan_recruitment
- cancel_plan
- expire_forming_plans
- record_attendance
- complete_activity
- create_experiences_for_completed_activity
- apply_account_restriction
- resolve_report

Each controlled action should:

1. authenticate the actor

2. check RLS-equivalent authorization

3. validate current state

4. lock affected rows when race conditions are possible

5. apply all related writes atomically

6. create lifecycle events

7. create audit events when required

8. create notifications or system messages

9. return a stable result contract

---

# Concurrency and Capacity Rules

Participant capacity is a transactional invariant.

When accepting a request or invitation:

1. lock the Plan row

2. count active participants

3. verify capacity

4. verify recruitment status

5. verify user restrictions and block relationships

6. insert or reactivate membership

7. attach the participant source Intent

8. update recruitment status to `full` when capacity is reached

9. create lifecycle and system-message records

10. commit atomically

The application must not rely on a client-side participant count.

---

# Time and Expiration Rules

All timestamps are stored as `timestamptz`.

Date-only Intent availability uses `date`.

Every Plan stores an IANA timezone.

Examples:

- Europe/Istanbul
- Europe/London
- America/New_York

Rules:

- Intent availability uses local date semantics.
- Final Plan schedule uses absolute timestamps plus timezone.
- Expiration jobs must be idempotent.
- Expiration is not cancellation.
- Completion is not inferred only from time passing.
- Attendance review may be required before completion.
- Daylight-saving transitions must be handled using timezone-aware scheduling.

---

# Deletion and Retention Rules

UIN prefers soft deletion for domain records.

Soft-deleted records use:

- deleted_at
- archived or deleted status
- visibility suppression

Soft deletion is preferred for:

- profiles
- intents
- plans
- experiences
- reflections
- messages

Reasons:

- portfolio integrity
- auditability
- safety
- dispute resolution
- reputation accuracy

Physical deletion may be required for:

- legal erasure obligations
- expired operational logs
- invalid projections
- provider delivery payloads
- temporary AI artifacts

Deletion must not leave orphaned foreign keys or leak deleted content through search, embeddings, recommendations or notifications.

---

# Naming Rules

1. Use `user_id` for references to a Person profile unless a more specific role improves clarity.

2. Use `host_user_id`, `inviter_user_id`, `invitee_user_id` and similar explicit names for role-bearing relationships.

3. Use `activity_type_id` for taxonomy.

4. Do not use `activity_id` to mean both taxonomy and real-world execution.

5. Use `plan_id` for the canonical shared coordination and Activity lifecycle record.

6. Use plural snake_case table names.

7. Use singular snake_case enum values.

8. Use `created_at`, `updated_at`, `deleted_at` consistently.

9. Use `status` only when the domain object has one canonical lifecycle status.

10. Use explicit secondary status names such as `recruitment_status`, `matching_status` and `attendance_status`.

---

# Database Design Invariants

1. Intent is the central origin entity.

2. Every account is a Person.

3. No Organization aggregate exists.

4. No Place or Venue account exists.

5. Location is metadata only.

6. No Match exists outside Intent.

7. No request or invitation exists outside Intent.

8. No Plan exists without one or more source Intent records.

9. Every Plan has exactly one active host-source Intent.

10. Activity is a scheduled or executed Plan state.

11. No standalone Activity may be created directly.

12. No Experience exists before Activity completion.

13. No reflection exists outside Experience.

14. No reputation event exists without an auditable source.

15. Profile visibility never implies Intent visibility.

16. Exact meeting location is protected independently from discovery visibility.

17. Participant identity is private by default.

18. Managed minor decisions require guardian authorization.

19. Friendship supports visibility and trust only.

20. Notifications must relate to Intent, Plan, Activity, Experience, guardian action or safety.

21. Search must respect current visibility.

22. AI must respect current visibility.

23. Analytics must not optimize for addiction.

24. Lifecycle and moderation history are append-only.

25. High-risk state transitions are transactional.

26. Capacity checks are server-side and race-safe.

27. Projections are rebuildable and never the sole source of truth.

28. Soft deletion must propagate to search, AI and recommendation projections.

29. The schema must support web, mobile and administrative clients.

30. Product terminology must remain consistent with:

```text
Person → Intent → Match / Request / Invitation → Plan → Activity → Experience
```

---

# Explicitly Excluded Models

The following models are not part of UIN:

- Organization accounts
- Organization profiles
- Organization members
- Organization-owned Intent
- Organization-hosted Activities
- Place accounts
- Venue profiles
- Venue-owned Intent
- Venue-hosted Activities
- Standalone Event creation
- Direct Activity creation
- Activity records without source Intent
- Follower economy
- Public like counts
- Passive content feed
- Engagement-driven notification prompts

These exclusions are architectural constraints, not temporary Phase 1 omissions.

---

# Migration Guidance

Before deleting legacy database objects:

1. inventory tables, views, functions, triggers, policies and foreign keys

2. identify application and RPC dependencies

3. export or archive data when needed

4. remove application reads and writes

5. deploy compatibility changes

6. verify production logs

7. remove dependent views and functions

8. remove policies and triggers

9. drop obsolete tables in a dedicated migration

10. rebuild generated database types

11. run production build and integration tests

12. verify that no route or workflow bypasses Intent

Legacy Organization or Venue ownership tables must not be retained as dormant future features.

Historical data that must be preserved should be transformed into Person-owned Intent, Plan or location metadata before obsolete structures are removed.
