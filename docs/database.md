# UIN Database Design

Version 1.0

## Core Rule

UIN database is designed around Intent.

Intent is the central entity.

Profiles, friendships, matches, activities, reflections, reputation and portfolio exist to support, execute or represent Intent.

Nothing may bypass Intent.

---

## Main Aggregates

### Person Aggregate

Represents a user's identity and accumulated Intent history.

Includes:

- profiles
- friendships
- reputation_events
- portfolio projections

---

### Intent Aggregate

Represents every intentional action regardless of time horizon.

Includes:

- intents
- intent_visibility
- intent_participants
- matches
- activities
- reflections
- lifecycle_events

---

### Activity Aggregate

Represents the real-world execution of an Intent.

Includes:

- activities
- activity_participants
- reflections
- reputation_events

---

### Organization Aggregate

Represents companies, NGOs, schools, communities and institutions.

Includes:

- organizations
- organization_members
- organization_intents

---

### Venue Aggregate

Represents physical places where Intent may become Activity.

Includes:

- venues
- venue_intents
- venue_activities

---

# Database Phases

## Phase 1 — Core Product

- profiles
- friendships
- intents
- intent_visibility
- intent_participants
- intent_lifecycle_events
- matches
- activities
- activity_participants
- reflections
- reputation_events
- notifications

## Phase 2 — Expansion

- categories
- life_themes
- venues
- organizations
- organization_members
- saved_intents
- followed_intents

## Phase 3 — Intelligence

- ai_embeddings
- recommendations
- analytics_events
- search_index
- portfolio_projections

---

# Tables

## profiles

Represents the UIN identity of a user.

Supabase auth.users handles authentication.

profiles handles product identity.

Fields:

- id uuid primary key references auth.users(id)
- username text unique
- full_name text
- avatar_url text
- bio text
- city text
- country text
- birth_year int
- onboarding_completed boolean
- created_at timestamptz
- updated_at timestamptz

Rules:

- A user owns one profile.
- Profile visibility does not imply Intent visibility.
- Profile exists to show Intent Biography, not social media content.

---

## friendships

Represents trust relationship between users.

Friendship is not the product.

Friendship is a trust and visibility layer for Intent.

Fields:

- id uuid primary key
- requester_id uuid references profiles(id)
- addressee_id uuid references profiles(id)
- status text
- level text
- created_from_activity_id uuid nullable
- created_at timestamptz
- updated_at timestamptz

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

- Friendship may control Intent visibility.
- Friendship may support invitations.
- Friendship must not create feed mechanics.
- Friendship must not create follower economy.

---

## intents

Central table of UIN.

Represents Tactical, Strategic and Telos Intent.

Fields:

- id uuid primary key
- owner_id uuid references profiles(id)
- parent_intent_id uuid nullable references intents(id)
- type text
- status text
- title text
- description text
- category_id uuid nullable
- goal text nullable
- location_text text nullable
- latitude numeric nullable
- longitude numeric nullable
- start_time timestamptz nullable
- end_time timestamptz nullable
- target_date date nullable
- budget_min numeric nullable
- budget_max numeric nullable
- capacity_min int nullable
- capacity_max int nullable
- progress numeric nullable
- created_at timestamptz
- updated_at timestamptz
- deleted_at timestamptz nullable

Intent Types:

- tactical
- strategic
- telos

Intent Statuses:

- draft
- published
- discoverable
- matched
- confirmed
- active
- completed
- experienced
- integrated
- archived
- cancelled

Rules:

- Everything starts with Intent.
- Tactical Intent may create Match and Activity.
- Strategic Intent may contain child Intent.
- Telos Intent represents direction and may never be completed.
- Completed or experienced Intent may become integrated into portfolio.
- Intent is soft-deleted, not physically deleted unless legally required.

---

## intent_visibility

Represents visibility policy for each Intent.

Fields:

- id uuid primary key
- intent_id uuid references intents(id)
- visibility_type text
- created_at timestamptz
- updated_at timestamptz

Visibility Types:

- public
- friends_only
- close_friends_only
- invite_only
- selected_users
- exclude_selected_users
- private_draft

Rules:

- Every Intent has its own visibility.
- Profile visibility never implies Intent visibility.
- Creator decides who can see, join, follow or be excluded from an Intent.

---

## intent_visibility_users

Represents selected or excluded users for Intent visibility.

Fields:

- id uuid primary key
- intent_id uuid references intents(id)
- user_id uuid references profiles(id)
- rule text
- created_at timestamptz

Rules:

- include
- exclude

---

## intent_participants

Represents users participating in or requesting to join an Intent.

Fields:

- id uuid primary key
- intent_id uuid references intents(id)
- profile_id uuid references profiles(id)
- role text
- status text
- created_at timestamptz
- updated_at timestamptz

Roles:

- owner
- participant
- invited
- observer

Statuses:

- pending
- accepted
- declined
- cancelled
- removed

Rules:

- Participants exist only in relation to Intent.
- No user may participate without visibility permission.

---

## intent_lifecycle_events

Represents every meaningful state change of an Intent.

Fields:

- id uuid primary key
- intent_id uuid references intents(id)
- actor_id uuid references profiles(id)
- event_type text
- from_status text nullable
- to_status text nullable
- metadata jsonb
- created_at timestamptz

Event Types:

- created
- published
- discovered
- joined
- matched
- confirmed
- started
- completed
- experienced
- integrated
- archived
- cancelled

Rules:

- Every meaningful Intent state change should create lifecycle event.
- Lifecycle events support audit, AI, portfolio and analytics.

---

## matches

Represents compatibility or relation between a user and Intent, or between two Intent records.

Fields:

- id uuid primary key
- intent_id uuid references intents(id)
- profile_id uuid nullable references profiles(id)
- matched_intent_id uuid nullable references intents(id)
- match_type text
- score numeric
- status text
- reason jsonb
- created_at timestamptz
- updated_at timestamptz

Match Types:

- user_to_intent
- intent_to_intent
- invited_user

Statuses:

- pending
- accepted
- declined
- expired
- cancelled

Rules:

- Match must always relate to Intent.
- No match exists outside Intent.
- Match is not dating logic.
- Match exists to help Intent become Activity.

---

## activities

Represents real-world execution of an Intent.

Fields:

- id uuid primary key
- intent_id uuid references intents(id)
- venue_id uuid nullable
- status text
- title text
- description text
- started_at timestamptz nullable
- ended_at timestamptz nullable
- location_text text nullable
- latitude numeric nullable
- longitude numeric nullable
- visibility_type text
- participant_visibility text
- created_at timestamptz
- updated_at timestamptz

Statuses:

- planned
- started
- completed
- cancelled
- no_show_reported

Participant Visibility:

- private
- participants_only
- friends_only
- public

Rules:

- Activity validates Intent.
- Activity belongs to Intent.
- Activity participant visibility is private by default.
- User-facing completed activity may be shown as Completed or Experienced.
- System may mark completed activity as integrated into portfolio.

---

## activity_participants

Represents users who took part in an Activity.

Fields:

- id uuid primary key
- activity_id uuid references activities(id)
- profile_id uuid references profiles(id)
- status text
- check_in_at timestamptz nullable
- check_out_at timestamptz nullable
- created_at timestamptz
- updated_at timestamptz

Statuses:

- invited
- confirmed
- attended
- missed
- cancelled

Rules:

- Activity participants are private by default.
- Participant names are shown only if visibility allows.

---

## reflections

Represents post-Activity feedback and memory.

Fields:

- id uuid primary key
- activity_id uuid references activities(id)
- profile_id uuid references profiles(id)
- rating int nullable
- mood text nullable
- text text nullable
- private_notes text nullable
- would_repeat boolean nullable
- created_at timestamptz
- updated_at timestamptz

Rules:

- Reflection happens after Activity.
- Reflection supports reputation, AI and portfolio.
- Reflection may be private.
- Reflection is not a public comment system.

---

## reputation_events

Represents earned trust signals.

Fields:

- id uuid primary key
- profile_id uuid references profiles(id)
- source_activity_id uuid nullable references activities(id)
- source_intent_id uuid nullable references intents(id)
- event_type text
- value numeric
- metadata jsonb
- created_at timestamptz

Event Types:

- completed_activity
- no_show
- cancelled_late
- organizer_success
- helpful_participant
- repeat_participant
- verified_identity
- reported_behavior

Rules:

- Reputation is earned through Activity.
- Reputation is not likes.
- Reputation is not follower count.
- Reputation contributes to trust score.

---

## notifications

Represents product notifications.

Fields:

- id uuid primary key
- profile_id uuid references profiles(id)
- type text
- title text
- body text
- related_intent_id uuid nullable references intents(id)
- related_activity_id uuid nullable references activities(id)
- read_at timestamptz nullable
- created_at timestamptz

Allowed Notification Types:

- intent_match_found
- intent_join_request
- intent_invitation
- activity_reminder
- activity_completed
- reflection_requested
- followed_intent_updated
- planned_intent_updated

Disallowed Notification Types:

- user_posted
- user_liked
- user_viewed_profile
- random_engagement_prompt

Rules:

- Notifications must be Intent-related.
- Notifications must not create attention addiction.

---

## categories

Represents Intent categories.

Fields:

- id uuid primary key
- name text
- slug text unique
- parent_id uuid nullable references categories(id)
- created_at timestamptz

Examples:

- coffee
- walking
- theatre
- concert
- sports
- learning
- volunteering
- travel
- entrepreneurship
- family

---

## life_themes

Represents derived themes from completed and planned Intent.

Fields:

- id uuid primary key
- profile_id uuid references profiles(id)
- theme text
- score numeric
- source text
- updated_at timestamptz

Rules:

- Life themes are derived, not manually selected.
- Life themes support Intent Portfolio.
- Life themes may be recalculated by AI or analytics jobs.

---

## venues

Represents physical places.

Fields:

- id uuid primary key
- name text
- description text nullable
- address text nullable
- city text nullable
- country text nullable
- latitude numeric nullable
- longitude numeric nullable
- created_at timestamptz
- updated_at timestamptz

Rules:

- Venue is optional in early UIN.
- Activities may reference Venue.
- Venues may later have organization accounts.

---

## organizations

Represents institutions.

Fields:

- id uuid primary key
- name text
- type text
- description text nullable
- website text nullable
- created_at timestamptz
- updated_at timestamptz

Organization Types:

- company
- ngo
- university
- school
- club
- community
- public_institution

Rules:

- Organizations may create Intent.
- Organizations may host Activities.
- Organizations may own Venues.

---

## organization_members

Represents users belonging to an Organization.

Fields:

- id uuid primary key
- organization_id uuid references organizations(id)
- profile_id uuid references profiles(id)
- role text
- status text
- created_at timestamptz

Roles:

- owner
- admin
- member

Statuses:

- active
- invited
- removed

---

## saved_intents

Represents Intent saved for later inspiration.

Fields:

- id uuid primary key
- profile_id uuid references profiles(id)
- intent_id uuid references intents(id)
- created_at timestamptz

Rules:

- Saving Intent is allowed.
- Saving Intent is not liking.
- Saved Intent is private by default.

---

## followed_intents

Represents following a long-term Intent or journey.

Fields:

- id uuid primary key
- profile_id uuid references profiles(id)
- intent_id uuid references intents(id)
- created_at timestamptz

Rules:

- Users follow Intent, not people.
- Followed Intent may send updates.
- This must not become follower economy.

---

## ai_embeddings

Represents AI vector data.

Fields:

- id uuid primary key
- entity_type text
- entity_id uuid
- embedding vector
- metadata jsonb
- created_at timestamptz

Entity Types:

- intent
- profile
- reflection
- activity

Rules:

- Used for recommendations and semantic matching.
- Must respect privacy and visibility rules.

---

## recommendations

Represents generated recommendations.

Fields:

- id uuid primary key
- profile_id uuid references profiles(id)
- recommended_intent_id uuid nullable references intents(id)
- recommendation_type text
- score numeric
- reason jsonb
- created_at timestamptz
- expires_at timestamptz nullable

Recommendation Types:

- similar_intent
- inspiring_intent
- tactical_suggestion
- strategic_suggestion
- telos_alignment
- friend_intent

Rules:

- Recommendations must be Intent-centered.
- Recommendations must not create passive scrolling.

---

## analytics_events

Represents product analytics.

Fields:

- id uuid primary key
- profile_id uuid nullable references profiles(id)
- event_type text
- entity_type text nullable
- entity_id uuid nullable
- metadata jsonb
- created_at timestamptz

Rules:

- Used for product improvement.
- Must not be used for attention-maximizing dark patterns.

---

## search_index

Represents searchable entities.

Fields:

- id uuid primary key
- entity_type text
- entity_id uuid
- searchable_text text
- metadata jsonb
- updated_at timestamptz

Entity Types:

- intent
- profile
- venue
- organization

Rules:

- Search results must respect visibility rules.
- Private Intent must never appear in search.

---

# Portfolio Model

Intent Portfolio is a domain concept.

It does not need to be a primary source table in Phase 1.

Portfolio is derived from:

- intents
- activities
- reflections
- reputation_events
- life_themes

User-facing Portfolio includes:

- Past Intent
- Active Intent
- Planned Intent
- Tactical Intent
- Strategic Intent
- Telos Intent
- Completed Activities
- Experienced Activities
- Life Themes

Internal integrated status means:

- Completed or experienced Intent has become part of the user's Intent Portfolio.

---

# Privacy Rules

## Profile Privacy

A visible profile may show:

- Basic profile
- Trust score
- Public portfolio summary
- Visible completed activities
- Visible planned Intent

A visible profile must not automatically expose private Intent.

---

## Intent Privacy

Every Intent owns its visibility policy.

Supported visibility:

- public
- friends_only
- close_friends_only
- invite_only
- selected_users
- exclude_selected_users
- private_draft

---

## Activity Privacy

Activity participant visibility is private by default.

Activity may be visible without participant names.

Examples:

- "Completed a walking activity in Kadıköy"
- "Completed a walking activity with Ahmet"

The second form requires participant visibility permission.

---

# RLS Principles

Every table must enable Row Level Security.

Users may read:

- their own private data
- public Intent
- Intent visible through friendship
- Intent they are invited to
- Activity they participated in
- profile data allowed by visibility rules

Users may write:

- their own profile
- their own Intent
- participation requests
- their own reflections
- friendship requests
- saved or followed Intent records

Users may not write:

- other users' profiles
- other users' Intent
- other users' reflections
- reputation events directly
- lifecycle events directly except through controlled actions

---

# Deletion Rules

UIN prefers soft deletion.

Intent, Activity and Reflection should not be physically deleted unless legally required.

Soft deleted records use:

- deleted_at
- archived status

Reasons:

- portfolio integrity
- auditability
- safety
- reputation accuracy

---

# Internal Status Language

User-facing language:

- Completed
- Experienced
- Added to Portfolio

Internal system language:

- completed
- experienced
- integrated

Integrated means the Intent has become part of the user's Intent Portfolio.

---

# Database Design Rules

1. Intent is the central entity.

2. No match exists outside Intent.

3. No activity exists outside Intent.

4. No reflection exists outside Activity.

5. No reputation exists without Activity, Intent or verified trust signal.

6. Profile visibility never implies Intent visibility.

7. Activity participant visibility is private by default.

8. Portfolio is derived from Intent history.

9. Friendship supports visibility and trust only.

10. Notifications must be Intent-related.

11. Search must respect visibility.

12. AI must respect visibility.

13. Analytics must not optimize for addiction.

14. All meaningful state changes must be logged.

15. The database must support web, mobile and admin clients.