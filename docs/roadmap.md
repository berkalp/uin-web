# UIN Product Roadmap

Version 2.0

---

# Vision

Build the world's first Intent Network.

UIN exists to help people turn Intent into real-world Activity.

The product must preserve one canonical lifecycle:

```text
Person → Intent → Match / Request / Invitation → Plan → Activity → Experience
```

Every roadmap item must strengthen this lifecycle.

No roadmap phase may introduce an alternate path that bypasses Intent.

UIN is not:

- a social media platform
- a content network
- a dating application
- an event marketplace
- an Organization platform
- a Venue platform
- an attention economy product

---

# Product Doctrine

The roadmap follows these permanent rules:

1. Every account represents a Person.

2. Only people create Intent.

3. No Organization account, profile, role or aggregate exists.

4. No Place or Venue account exists.

5. Location is metadata attached to Intent, Plan and Activity context.

6. No standalone Activity or Event may be created directly.

7. Every Plan derives from one or more Intent records.

8. Activity is the scheduled or executed lifecycle state of a Plan.

9. Experience follows completed Activity.

10. Trust is earned from verified behavior.

11. Privacy and safety override discovery and ranking.

12. AI assists the user but never replaces user intent or authorization.

13. UIN optimizes for successful real-world outcomes, not screen time.

14. Product quality takes priority over premature feature expansion.

15. Each phase must be production-ready within its defined scope.

---

# Roadmap Strategy

The roadmap is organized by product capability, not by arbitrary feature accumulation.

Each phase must satisfy four conditions before the next phase begins:

- domain model is coherent
- database rules are enforceable
- user flow is understandable
- production behavior is observable

A feature is not complete merely because its screen exists.

It is complete when:

- data model is stable
- permissions are enforced
- lifecycle is coherent
- error states are handled
- auditability exists
- tests cover critical behavior
- the user can complete the intended real-world outcome

---

# Phase 0 — Product Foundation

## Status

Substantially Complete, Continuing as Governance

## Goal

Define the product so clearly that future implementation cannot quietly turn UIN into another social network or event platform.

## Deliverables

- Vision
- Core Principles
- Domain Model
- Database Design
- Architecture
- API Design
- Intent Builder
- Match Engine
- Reputation System
- UI Philosophy
- Product Roadmap
- Changelog
- Terminology Rules
- Lifecycle Invariants

## Required Decisions

- Person is the only account type.
- Intent is the origin entity.
- Plan is the coordination aggregate.
- Activity is a Plan lifecycle state.
- Experience follows completion.
- Organization and Venue models are excluded.
- Direct Activity creation is excluded.
- Managed minor safety is a first-class concern.
- Product architecture is production-oriented, not disposable MVP code.

## Success Criteria

- The product can be explained without discussing technology.
- Every major screen maps to the canonical lifecycle.
- No route, table or workflow bypasses Intent.
- Documentation uses consistent terminology.
- Product boundaries are explicit enough to reject conflicting feature proposals.

---

# Phase 1 — Core Intent Product

## Status

In Progress

## Goal

Allow a Person to create, manage and understand Intent as the core unit of UIN.

## Capabilities

### Authentication and Identity

- Google Authentication
- stable profile creation
- username management
- avatar and cover image
- profile settings
- account state handling
- first-login onboarding
- subsequent-login timeline routing

### Intent Builder

- Tactical Intent
- Strategic Intent
- Telos Intent
- predefined category and Activity Type
- date range
- recurrence
- location metadata
- participant preference
- capacity
- budget
- visibility
- optional notes
- Create Again
- duplicate detection
- draft handling
- validation

### Intent Lifecycle

- draft
- active
- planned
- completed
- cancelled
- archived
- expired state handling
- recruitment status
- matching status
- lifecycle events

### Timeline

- Open
- Full
- Closed
- Participating
- Planned
- Action Required
- Completed
- Expired
- Cancelled

### Intent Management

- edit Intent
- close recruitment
- reopen recruitment
- cancel Intent
- manage visibility
- copy previous Intent
- expiration handling

## Technical Requirements

- server-side validation
- RLS for all Intent access
- transactional lifecycle actions
- no client-only permission enforcement
- stable error states
- audit-safe lifecycle logging
- generated database types
- production build passing
- integration tests for critical transitions

## Success Criteria

- A user can create a valid Intent without confusion.
- Intent state is always understandable.
- No direct Activity is created.
- Visibility behaves correctly across multiple accounts.
- Expired and cancelled Intent remain historically accurate.
- Timeline accurately represents the user's current lifecycle state.

---

# Phase 2 — Matching, Requests and Invitations

## Goal

Help compatible Intent records discover one another and create legitimate connection paths.

## Capabilities

### Match Engine v1

- Activity Type compatibility
- date overlap
- location compatibility
- visibility filtering
- lifecycle filtering
- capacity filtering
- block filtering
- basic trust adjustment
- explainable Match reasons

### Match Interfaces

- Matches page
- Match detail
- dismiss Match
- refresh stale Match
- visibility-safe owner summary

### Intent Requests

- send request
- receive request
- accept
- reject
- withdraw
- expire
- request history
- duplicate request prevention

### Intent Invitations

- send invitation
- receive invitation
- accept
- decline
- withdraw
- revoke
- expire
- invitation history

### Inbox

- pending decisions only
- Intent requests
- Intent invitations
- join requests
- guardian actions
- separate notifications from decisions

## Technical Requirements

- hard filters before scoring
- transactional acceptance
- capacity recheck at acceptance
- visibility recheck at read and write time
- block relationship enforcement
- stale Match invalidation
- concurrency-safe duplicate prevention
- notification generation
- audit and lifecycle events

## Success Criteria

- Compatible Intent can find one another.
- Incompatible or private Intent never leak.
- Requests and invitations have clear, separate states.
- Accepted connections do not create Activity directly.
- Accepted connections produce or update a valid Plan.
- No capacity race allows overbooking.

---

# Phase 3 — Planning Rooms and Plan Formation

## Goal

Turn accepted Intent connections into a coordinated shared Plan.

## Capabilities

### Plan Formation

- create Plan from accepted Intent connection
- host-source Intent
- participant-source Intent
- host membership
- participant membership
- Co-host role
- active and detached Intent links

### Planning Room

- members
- roles
- conversation
- system messages
- schedule draft
- budget commitments
- target budget
- participant capacity
- recruitment state
- location refinement
- meeting point draft

### Membership Actions

- add participant
- remove participant
- withdraw
- accept invitation
- decline invitation
- transfer or assign Co-host where policy allows
- guardian-approved managed minor participation

### Recruitment

- open
- full
- closed
- reopen
- auto-close when capacity is reached
- prevent new Match after lifecycle transition

## Technical Requirements

- one active host-source Intent per Plan
- one active membership per Person per Plan
- host not counted twice
- budget recalculation after withdrawal or removal
- system message for membership changes
- transaction-safe Plan formation
- room access enforced by RLS
- conversation read state
- unread count projection

## Success Criteria

- Accepted people can coordinate in one coherent room.
- Membership, budget and capacity remain consistent.
- Every Plan has source Intent.
- No user can access a Planning Room without authorization.
- Plan remains forming until schedule is explicitly finalized.
- Plan state survives refresh, concurrent actions and partial failure.

---

# Phase 4 — Activity Lifecycle

## Goal

Convert a forming Plan into a real, scheduled and completed Activity.

## Capabilities

### Finalization

- scheduled start
- scheduled end
- timezone
- meeting point
- final location
- schedule notes
- final participant list
- final budget summary
- final visibility review

### Planned Activity

- Activity detail
- Activity Room
- map preview
- Street View preview when available
- participant list
- host identity
- schedule display
- reminder notifications
- visibility-safe public representation

### Lifecycle Actions

- finalize Plan
- reschedule
- cancel
- reopen forming state only where policy allows
- complete Activity
- mark attendance
- handle no-show
- handle participant cancellation
- handle host cancellation
- expire unfinalized Plans

### Activity Room

- conversation continues after finalization
- historical Planning Room messages remain available
- system schedule events
- participant updates
- completion prompts
- post-Activity reflection entry

## Technical Requirements

- finalization transaction
- required schedule fields
- timezone-safe storage
- immutable lifecycle history
- authorization for host and Co-host
- attendance auditability
- exact location protection
- reminder scheduling
- completion action after scheduled end
- cancellation distinct from expiration

## Success Criteria

- Every Activity derives from a Plan.
- Every Plan derives from Intent.
- Schedule is clear and timezone-safe.
- Participants see accurate membership and location information.
- Completion and attendance states are consistent.
- Cancelled and expired records remain historically correct.
- Activity Room continues the same Plan context without duplicate rooms.

---

# Phase 5 — Experience and Portfolio

## Goal

Turn completed Activity into meaningful personal history rather than disposable feed content.

## Capabilities

### Experience

- personal Experience record
- attendance-linked outcome
- private reflection
- optional public reflection
- would-repeat signal
- portfolio integration
- Experience visibility

### Reflection

- rating
- mood
- public text
- private notes
- category feedback
- accessibility feedback
- safety feedback
- dispute-safe handling

### Portfolio

- Past Intent
- Active Intent
- Future Intent
- Tactical Intent
- Strategic Intent
- Telos Intent
- Planned Activities
- Completed Activities
- public Experiences
- life themes
- milestones

### Profile

- Intent biography
- public Intent
- public planned Activity
- public Experience
- trust summary
- no follower economy
- no public like counts

## Technical Requirements

- one Experience per Person per completed Plan
- reflection privacy
- participant identity protection
- rebuildable portfolio projection
- safe public profile query
- soft deletion propagation
- no private data leakage through projections

## Success Criteria

- Completed Activity becomes meaningful history.
- Private reflection remains private.
- Public Experience exposes only authorized information.
- Portfolio can be rebuilt from source records.
- Profile communicates lived Intent without becoming a social feed.

---

# Phase 6 — Family and Managed Profiles

## Status

Partially Implemented

## Goal

Support children and managed profiles with guardian-controlled safety.

## Capabilities

### Family Center

- age and family settings
- managed child profile
- Primary Guardian
- Guardian
- relationship status
- guardian invitation
- guardian acceptance and revocation
- permission management

### Managed Profile Controls

- profile management
- Activity participation control
- independent Intent restriction
- guardian approval
- supervising guardian
- private attendance history
- exact location restrictions
- child-safe public profile

### Guardian Inbox

- pending invitations
- approved invitations
- declined invitations
- past invitations
- participation decisions
- audit history

## Technical Requirements

- server-side guardian authorization
- managed minor RLS
- no UI-only enforcement
- audit event for permission changes
- exact location privacy
- guardian decision traceability
- public numerical reputation prohibited for minors

## Success Criteria

- A child cannot bypass guardian policy.
- Guardians can understand and manage participation.
- Public surfaces do not expose sensitive minor data.
- Activity participation remains compatible with the canonical Intent lifecycle.
- Guardian actions are traceable and reversible where appropriate.

---

# Phase 7 — Trust, Safety and Moderation

## Goal

Make real-world participation safer without turning reputation into public ranking.

## Capabilities

### Reputation

- attendance reliability
- Host Reliability
- Planning Quality
- communication reliability
- category experience
- identity verification
- recovery
- decay
- dispute
- reversal
- bounded Match adjustment

### Safety

- reports
- profile reporting
- Intent reporting
- Plan reporting
- message reporting
- Experience reporting
- manual review
- moderation decisions
- appeals
- account restrictions

### Restrictions

- read-only
- no new Intent
- no requests
- no invitations
- no Plan creation
- no messaging
- suspension

### Administration

- user management
- Intent review
- Plan review
- request review
- moderation queue
- restrictions
- audit log

## Technical Requirements

- append-only reputation events
- raw report does not change reputation
- moderation actions audited
- restriction enforcement server-side
- report confidentiality
- dispute workflow
- projection rebuild
- no public leaderboard
- no purchasable trust

## Success Criteria

- Unsafe behavior can be reported and reviewed.
- Restrictions actually prevent prohibited actions.
- Reputation remains contextual and recoverable.
- New users are not treated as inherently untrusted.
- Public trust output does not expose private allegations.
- Administrative changes are auditable.

---

# Phase 8 — Discovery and Search

## Goal

Help people find relevant Intent without creating an infinite passive feed.

## Capabilities

- Intent search
- category filtering
- Activity Type filtering
- location filtering
- date filtering
- visibility-aware results
- saved Intent
- followed Intent
- friend-visible Intent
- public Experience discovery
- limited profile discovery through relevant Intent context

## Product Rules

- search is Intent-first
- no Organization search
- no Venue profile search
- location is a filter, not an entity feed
- no infinite engagement feed
- no popularity ranking
- no paid ranking that bypasses compatibility
- no private Intent indexing

## Technical Requirements

- rebuildable search documents
- real-time visibility recheck
- deletion propagation
- search projection versioning
- safe location precision
- query observability
- relevance testing

## Success Criteria

- Users can find relevant Intent quickly.
- Search never reveals unauthorized Intent.
- Results remain contextual and actionable.
- Discovery leads to requests, invitations or Plans rather than passive scrolling.

---

# Phase 9 — AI Assistance

## Goal

Use AI to reduce friction and improve real-world success while preserving user control.

## Capabilities

### Intent Assistance

- natural-language Intent draft
- Intent type suggestion
- category suggestion
- Activity Type suggestion
- duplicate detection
- title clarification
- recurrence suggestion
- visibility explanation
- Strategic-to-Tactical decomposition
- Telos alignment suggestion

### Match Intelligence

- semantic similarity
- related Activity Types
- explainable Match reasons
- stale Match detection
- group compatibility support
- fairness monitoring

### Planning Assistance

- schedule suggestions
- budget suggestions
- location refinement
- travel-time estimation
- weather-aware guidance
- accessibility reminders
- cancellation-risk warnings

### Portfolio Intelligence

- life themes
- Intent patterns
- completed Activity summaries
- meaningful milestones
- private reflection support
- next Tactical step suggestions

## Product Rules

AI must not:

- publish Intent without confirmation
- accept requests
- send invitations
- create Plan without authorization
- finalize Activity
- make guardian decisions
- override privacy
- infer protected attributes
- permanently judge users
- optimize for engagement
- invent current external facts

## Technical Requirements

- model versioning
- prompt and output logging policy
- privacy-aware embeddings
- visibility inheritance
- deletion invalidation
- explanation storage
- human override
- cost monitoring
- fallback behavior
- provider abstraction

## Success Criteria

- AI reduces creation and planning friction.
- AI suggestions are understandable and reversible.
- AI improves completed real-world outcomes.
- Privacy and authorization remain stronger than AI convenience.
- Product remains useful when AI is unavailable.

---

# Phase 10 — Mobile Applications

## Goal

Provide a native mobile experience for real-world coordination.

## Platforms

- iOS
- Android

## Capabilities

- authentication
- Intent creation
- Match review
- requests and invitations
- Planning Room
- Activity Room
- push notifications
- maps
- location permission controls
- camera support
- voice Intent creation
- offline draft
- calendar integration
- Activity reminders
- check-in where policy allows

## Technical Requirements

- shared API contracts
- stable authentication sessions
- push token management
- offline conflict handling
- secure local storage
- deep links
- location privacy
- accessibility
- app-store compliance

## Success Criteria

- Core lifecycle works end to end on mobile.
- Mobile does not introduce alternate domain rules.
- Users can coordinate an Activity without desktop dependency.
- Push notifications support action without becoming spam.

---

# Phase 11 — Internationalization and Regional Scale

## Goal

Support people across languages, cultures and timezones without weakening product semantics.

## Capabilities

- multilingual UI
- localized date and time
- international timezones
- regional Activity taxonomy
- translation assistance
- country and city discovery
- regional safety policy
- local legal compliance
- multi-currency budget support
- multilingual moderation

## Technical Requirements

- locale-safe routing
- timezone-safe scheduling
- translation versioning
- regional data retention
- jurisdiction-aware consent
- multi-currency precision
- localized notification delivery
- regional observability

## Success Criteria

- Users in different countries can form coherent Plans.
- Timezone handling remains correct.
- Translation does not alter Intent meaning.
- Regional policy differences remain auditable.
- Location metadata scales without creating Place accounts.

---

# Phase 12 — Intent Intelligence Platform

## Goal

Help people manage long-term intentional living without becoming a coercive life-management system.

## Capabilities

- Personal Intent Assistant
- Strategic planning
- Telos alignment
- calendar integration
- habit integration
- journey timeline
- personal knowledge graph
- recurring Intent review
- Intent dependency mapping
- life-theme evolution
- private progress reflection
- planning across multiple Tactical Intent records

## Product Rules

- UIN does not claim authority over the user's life.
- AI suggestions remain optional.
- Telos is not scored competitively.
- Private reflection is not used for advertising.
- The system must not create guilt-driven engagement.
- The user may disable proactive suggestions.

## Success Criteria

- Users can connect daily action to long-term direction.
- The system helps without becoming controlling.
- Strategic and Telos Intent remain meaningful domain entities.
- Real-world Activity remains the proof of execution.
- The product reduces digital noise rather than adding to it.

---

# Cross-Phase Technical Roadmap

## Architecture

### Current

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth
- PostgreSQL
- Supabase RLS
- Vercel
- Google Authentication

### Near-Term

- transactional RPC actions
- generated database types
- structured error contracts
- service-layer boundaries
- lifecycle event framework
- audit event framework
- background jobs
- realtime room updates
- notification delivery
- observability

### Scale

- queue system
- caching
- search service
- vector search
- projection workers
- rate limiting
- abuse detection
- multi-region strategy
- mobile API stability
- disaster recovery
- data-retention automation

---

# Database Roadmap

## Immediate

- remove legacy Organization objects
- remove legacy standalone Activity paths
- inventory remote database objects
- align RPC names with Person and Intent model
- enforce Plan source Intent invariant
- enforce capacity transactionally
- rebuild generated types
- add lifecycle and audit events

## Near-Term

- normalize Activity Type taxonomy
- separate `activity_types` from real Activity lifecycle terminology
- strengthen location metadata
- add Plan message reads
- add attendance records
- add Experience
- add reputation event projection
- add restriction enforcement

## Later

- search documents
- embeddings
- recommendations
- portfolio projections
- analytics events
- retention jobs
- projection rebuild jobs

---

# API Roadmap

## Version 1

- profile
- Intent
- visibility
- Match
- request
- invitation
- Plan
- membership
- conversation
- finalization
- completion
- notification

## Version 2

- Experience
- reflection
- portfolio
- reputation
- reports
- restrictions
- family
- managed profile
- search

## Version 3

- AI assistance
- recommendations
- life themes
- calendar integration
- mobile synchronization
- regional services

## API Rules

- stable response contracts
- transactional writes
- no direct client lifecycle mutation
- authorization at the server
- idempotency for critical actions
- versioned errors
- auditability
- no Organization endpoints
- no direct Activity creation endpoint

---

# Match Engine Roadmap

## Version 1

- same Activity Type
- same district
- overlapping dates
- public visibility
- active lifecycle
- basic capacity
- basic trust

## Version 2

- recurrence
- travel radius
- budget compatibility
- participant preference
- friend visibility
- previous Activity adjustment
- stale Match invalidation
- explainable reasons

## Version 3

- semantic similarity
- group compatibility
- Strategic relevance
- Telos alignment
- fairness testing
- model versioning
- contextual external data

## Version 4

- predictive schedule feasibility
- travel-time optimization
- weather-aware planning
- recurring Plan optimization
- regional matching
- adaptive but bounded ranking

---

# Reputation Roadmap

## Version 1

- completed Activity
- attendance
- no-show
- cancellation
- Host Reliability
- participant reliability
- identity verification

## Version 2

- category-specific evidence
- decay
- recovery
- disputes
- reversal events
- confidence
- public trust summary

## Version 3

- fairness review
- managed minor safeguards
- advanced abuse detection
- context-aware reliability
- badge and milestone projection
- algorithm migration tooling

---

# Portfolio Roadmap

## Version 1

- active Intent
- planned Activity
- completed Activity
- public profile summary

## Version 2

- Experience
- reflection
- life themes
- milestones
- public and private visibility

## Version 3

- journey timeline
- Tactical, Strategic and Telos relationships
- AI summaries
- recurring Intent patterns
- personal life map
- rebuildable projection tools

---

# Mobile Roadmap

## Version 1

- responsive web
- installable web application
- mobile-safe forms
- mobile Planning Room

## Version 2

- native authentication
- push notifications
- maps
- offline drafts
- camera and voice input

## Version 3

- calendar integration
- check-in
- travel guidance
- background synchronization
- wearable integration where justified

---

# Quality Gates

No phase is considered complete without:

- production build success
- TypeScript success
- database migration review
- RLS review
- critical integration tests
- lifecycle invariant tests
- accessibility review
- privacy review
- safety review
- error-state handling
- loading-state handling
- empty-state handling
- observability
- rollback plan
- documentation update
- changelog entry

---

# Testing Roadmap

## Unit Tests

- lifecycle functions
- date overlap
- capacity
- visibility
- score calculation
- budget calculation
- attendance
- reputation decay
- projection logic

## Integration Tests

- authentication
- create Intent
- edit Intent
- Match
- request
- invitation
- Plan formation
- membership
- finalization
- completion
- Experience
- guardian approval
- restriction enforcement
- report workflow

## End-to-End Tests

- first login to first Intent
- two-account Match flow
- request acceptance to Plan
- Plan to Activity
- Activity to Experience
- managed minor invitation
- account restriction
- public profile visibility
- cancellation and expiration

## Load Tests

- Match generation
- concurrent acceptance
- room messaging
- notification delivery
- search
- projection rebuild
- portfolio query
- background expiration

---

# Product Success Metrics

UIN succeeds when:

- people publish meaningful Intent
- compatible Intent forms a Plan
- Plans become scheduled Activities
- Activities are completed
- attendance remains reliable
- users repeat successful real-world participation
- users report improved life outcomes
- managed minor participation remains safe
- trust systems reduce harmful outcomes
- AI improves completion without weakening control

Primary lifecycle metrics:

```text
Intent Published
        ↓
Compatible Connection
        ↓
Plan Formed
        ↓
Activity Finalized
        ↓
Activity Completed
        ↓
Experience Created
```

---

# Metrics UIN Does Not Optimize

- time spent
- infinite scroll depth
- profile views
- follower growth
- likes
- public reactions
- notification opens without action
- daily active use without real-world outcome
- content volume
- public popularity
- paid ranking
- compulsive return

---

# Permanent Product Boundaries

UIN will never become:

- a social media feed
- a short-video platform
- a follower economy
- a dating application
- a popularity contest
- an advertising attention marketplace
- an Organization account platform
- a Venue account platform
- an Event listing marketplace
- a direct Activity creation tool
- a public human ranking system
- a manipulative life-coaching system

These are permanent architectural boundaries, not postponed roadmap items.

---

# Explicitly Removed From the Roadmap

The following items existed in earlier drafts and are no longer part of UIN:

- Organization Profiles
- Company Accounts
- University Accounts
- NGO Accounts
- Community Accounts
- Organization Intent
- Organization-hosted Activities
- Organization memberships
- Venue Profiles
- Venue ownership
- Venue-hosted Activities
- standalone Event creation
- direct Activity creation
- Organization roadmap phase

Historical references should be removed from active product documentation and migrations.

---

# Long-Term Goal

Create a global Intent Network where people can:

- express what they intend to do
- discover compatible Intent
- form trustworthy Plans
- coordinate real-world Activities
- reflect on lived Experience
- connect daily action to long-term direction

UIN should help people spend less time consuming digital noise and more time intentionally living.

---

# Final Milestone

The vision is achieved when a Person can honestly say:

```text
I lived a richer life because UIN helped me turn Intent into reality.
```
