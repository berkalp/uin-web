# UIN Match Engine

Version 2.0

---

# Purpose

The Match Engine helps compatible Intent records become a shared Plan.

It does not match people independently of Intent.

People become visible to one another only because their Intent records create a legitimate reason for connection.

The canonical lifecycle is:

```text
Person → Intent → Match / Request / Invitation → Plan → Activity → Experience
```

Without Intent, there is no Match.

Without an accepted connection, there is no shared Plan.

Without a finalized Plan, there is no Activity.

---

# Core Product Rules

1. Every account represents a Person.

2. Only people create Intent.

3. The Match Engine evaluates Intent records, not Organization accounts.

4. No Organization Match, Organization Intent or Organization actor exists.

5. No Place or Venue account participates in matching.

6. Location is metadata used as a compatibility signal.

7. Match must always reference one or more Intent records.

8. Match never creates an Activity directly.

9. Accepted Match, Request or Invitation may create or update a Plan through a controlled transaction.

10. Privacy, blocking, age policy, guardian policy and account restrictions override score.

11. Popularity, follower count and profile views are not Match factors.

12. Match explanations must be understandable without exposing private data or proprietary scoring details.

---

# Match Philosophy

Traditional social platforms ask:

```text
Who should you meet?
```

UIN asks:

```text
What are you trying to do?
```

The declared Intent creates the reason for connection.

The Match Engine exists to support real-world execution, not browsing, swiping or attention capture.

A good Match should increase the probability that compatible people form a viable Plan and complete an Activity safely.

---

# What the Match Engine Matches

## Primary Model

The canonical Match is:

```text
Intent ↔ Intent
```

Each side belongs to a Person.

The system evaluates whether the two Intent records are compatible enough to surface as a candidate connection.

---

## Discovery Model

A Person may discover a visible Intent:

```text
Person → Visible Intent
```

This is discovery, not a Person-to-Person Match.

The Person must act through one of the following:

- a compatible source Intent
- a participation request linked to an Intent
- an invitation linked to an Intent
- a controlled solo-participation policy where product rules explicitly allow it

The UI may show limited owner information after visibility and safety checks.

---

## Explicitly Excluded Models

The Match Engine does not support:

- Person-to-Person matching without Intent
- Organization-to-Person matching
- Organization-to-Intent matching
- Place-to-Person matching
- Venue-to-Intent matching
- Event discovery outside Intent
- direct Activity creation
- swipe ranking
- follower-based ranking
- popularity ranking
- paid ranking that bypasses compatibility
- hidden preference inference from sensitive personal attributes

These exclusions are architectural constraints.

---

# High-Level Match Flow

```text
Candidate Intent Pair

↓

Eligibility Filters

↓

Visibility Evaluation

↓

Safety and Restriction Evaluation

↓

Compatibility Scoring

↓

Ranking

↓

Explanation Generation

↓

Candidate Match

↓

Request or Invitation

↓

Acceptance

↓

Plan Formation
```

Hard filters run before scoring.

A failed hard filter removes the candidate regardless of score.

---

# Match Inputs

The Match Engine may use:

- Intent type
- Activity Type
- category
- date availability
- recurrence
- location metadata
- travel radius
- participant preference
- capacity
- budget compatibility
- visibility policy
- friendship relationship
- block relationship
- trust projection
- category-specific reliability
- previous shared Activity outcomes
- account restrictions
- managed minor policy
- semantic similarity
- current lifecycle state
- source data freshness
- algorithm version

The Match Engine must not use data that the Person did not authorize for that purpose.

---

# Intent Type Compatibility

Intent type affects how matching works.

## Tactical ↔ Tactical

This is the primary real-world execution Match.

Examples:

- Walking in Kadıköy this weekend
- Museum visit in Kadıköy on Saturday
- Basketball in Üsküdar next week

Tactical matching emphasizes:

- Activity Type
- date overlap
- location compatibility
- capacity
- visibility
- safety
- trust

---

## Strategic ↔ Strategic

Strategic Intent may connect people with compatible medium- or long-term goals.

Examples:

- Improve conversational English
- Become more physically active
- Build a sustainability network

Strategic matching emphasizes:

- goal similarity
- time horizon
- category
- preferred collaboration style
- location scope
- visibility

A Strategic Match does not automatically create an Activity.

It may lead to:

- inspiration
- a conversation
- a child Tactical Intent
- a recurring Plan
- a shared milestone

---

## Telos ↔ Telos

Telos matching must be conservative.

Telos may support:

- visible inspiration
- long-term alignment
- shared life themes
- Strategic Intent discovery

Telos must not be treated as a dating profile or personality Match.

Telos matching should normally require explicit visibility and strong user control.

---

## Cross-Type Compatibility

Different Intent types may relate when a clear lifecycle relationship exists.

Examples:

```text
Telos → Strategic
Strategic → Tactical
```

A Tactical Intent may support a Strategic Intent.

A Strategic Intent may support a Telos direction.

Cross-type relevance may be shown as:

- Supports your Strategic Intent
- Aligned with your Telos
- Possible next Tactical step

Cross-type relevance is not the same as a participation Match.

---

# Candidate Generation

Candidate generation creates a manageable set of possible Intent pairs before detailed scoring.

Candidate generation may filter by:

- active lifecycle state
- compatible Activity Type or category
- overlapping availability
- geographic scope
- visibility eligibility
- capacity
- language or accessibility requirements
- recurrence compatibility
- algorithm freshness

Candidate generation should use indexed fields before semantic ranking.

A typical sequence:

1. query active discoverable Intent

2. apply visibility scope

3. apply date overlap

4. apply location scope

5. apply Activity Type or category compatibility

6. exclude same-owner Intent where inappropriate

7. exclude blocked or restricted relationships

8. send remaining candidates to detailed scoring

---

# Eligibility Filters

Eligibility filters determine whether a Match is legally and operationally possible.

## Lifecycle Filter

An Intent is ineligible when:

- draft
- cancelled
- archived
- expired
- soft-deleted
- linked exclusively to a finalized conflicting Plan
- matching status is closed
- account policy prevents matching

---

## Ownership Filter

Rules:

- A Person cannot Match an Intent with another Intent they own when the product flow requires distinct participants.
- Duplicate personal Intent detection is handled separately.
- Source and candidate Intent must have valid owners.
- Deleted or restricted profiles may be excluded according to policy.

---

## Visibility Filter

Visibility is evaluated before scoring.

Supported visibility may include:

- public
- friends_only
- close_friends_only
- selected_users
- exclude_selected_users
- invite_only
- private_draft

Rules:

- Private Draft never enters Match.
- Invite Only appears only through a valid invitation path.
- Selected Users requires explicit inclusion.
- Excluded Users overrides other access.
- Block relationships override all visibility.
- Profile visibility does not grant Intent visibility.
- Visibility must be re-evaluated at read time.

---

## Restriction Filter

Active account restrictions may block:

- new Match discovery
- sending requests
- sending invitations
- Plan creation
- messaging
- participation

Restrictions must be enforced server-side.

UI hiding is not enforcement.

---

## Managed Minor Filter

Managed minor matching may require:

- guardian-approved discoverability
- age-appropriate Activity Type
- guardian approval before participation
- restricted exact location
- restricted communication
- supervising guardian assignment

The Match Engine must not infer that a visible managed minor profile is freely matchable.

---

## Blocking Filter

Blocking is absolute.

A block must prevent:

- candidate generation
- Match display
- requests
- invitations
- Plan co-membership where policy requires
- profile leakage through Match explanation
- notification leakage

Block checks must be symmetric in effect even if stored directionally.

---

## Capacity Filter

Capacity may exclude a candidate when:

- recruitment is full
- recruitment is closed
- Plan capacity has been reached
- the candidate would violate a managed group-size policy

Capacity must be verified again transactionally during acceptance.

A precomputed count is not sufficient.

---

## Date Filter

Tactical Intent requires meaningful date compatibility.

Examples:

- overlapping date range
- compatible recurring schedule
- flexible date within candidate window
- timezone-safe interpretation

A Match should be rejected or heavily penalized when no realistic overlap exists.

---

## Location Filter

Location compatibility may use:

- same district
- same city
- distance radius
- travel willingness
- online mode
- flexible location
- region-level compatibility

Exact meeting point is not required at Match stage.

Private coordinates must not be exposed in Match explanations.

---

# Compatibility Dimensions

## Activity Type Similarity

This is normally the strongest Tactical signal.

Examples:

- Walking ↔ Walking
- Theatre ↔ Theatre
- Basketball ↔ Basketball

Related Activity Types may receive partial compatibility:

- Walking ↔ Hiking
- Museum Visit ↔ Cultural Tour
- Study Session ↔ Language Practice

Activity taxonomy should define relatedness explicitly where possible.

AI semantic similarity may supplement taxonomy but must not override incompatible structured fields.

---

## Category Compatibility

Category is broader than Activity Type.

It supports:

- fallback candidate generation
- Strategic matching
- cross-type relevance
- new Activity Type discovery

Category alone is usually insufficient for a high-confidence Tactical Match.

---

## Availability Compatibility

Availability scoring may consider:

- date overlap
- overlap duration
- recurrence compatibility
- weekday preference
- flexible window
- timezone
- urgency
- expiry proximity

The Intent stage uses availability windows.

Final time belongs to the Plan.

The system must not fabricate final schedule compatibility from missing time data.

---

## Geographic Compatibility

Geographic scoring may consider:

- same district
- same city
- distance
- transit time
- declared travel radius
- online compatibility
- location flexibility

Geographic scoring should be Activity-sensitive.

Examples:

- Coffee may require close distance.
- Travel may allow national or international distance.
- Online study may ignore physical distance.

External travel-time data must be current when used.

---

## Participation Compatibility

Participation compatibility may consider:

- solo versus group preference
- preferred group size
- maximum capacity
- with child
- with family
- with partner
- open to compatible people
- accessibility requirements

The engine must not convert vague social preferences into sensitive demographic filtering.

---

## Budget Compatibility

Budget compatibility may compare:

- no-cost expectation
- personal budget
- contribution range
- Plan target budget
- expected cost category

Budget mismatch may reduce score or block a Match when the Activity cannot be viable.

Budget data must not become a proxy for protected characteristics.

---

## Recurrence Compatibility

Recurring Intent may match when:

- recurrence patterns overlap
- both users accept recurring participation
- time horizon is compatible
- location remains viable

A one-time Intent may still Match a recurring Intent when one occurrence overlaps and the user accepts that context.

---

## Trust Compatibility

Trust may influence ranking after eligibility is established.

Signals may include:

- verified identity
- completed Activities
- attendance reliability
- host reliability
- cancellation behavior
- safety restrictions
- resolved disputes
- recent behavior

Trust must not become a permanent caste system.

Recent improvement and context should matter.

Raw moderation details must not appear in Match explanations.

---

## Category-Specific Reliability

Reliability may differ by Activity context.

Examples:

- reliable hiking participant
- reliable study partner
- experienced event host

Category-specific reliability may be useful, but it must:

- use sufficient evidence
- avoid false precision
- decay or update over time
- remain explainable
- avoid exposing private reports

---

## Friendship

Friendship never creates a Match by itself.

It may:

- satisfy friends-only visibility
- provide a small ranking boost
- support invitations
- reduce uncertainty

Friendship must not dominate Intent compatibility.

---

## Previous Shared Activity

Successful previous Activities may provide a modest boost.

Signals may include:

- both attended
- both chose would-repeat
- no unresolved safety issue
- compatible recurring pattern

Previous shared Activity must not override current incompatibility.

---

## Semantic Similarity

AI may recognize semantically similar Intent wording.

Examples:

```text
I want to drink coffee.
Anyone for espresso?
Looking for a café visit.
```

Semantic similarity must:

- supplement structured taxonomy
- record model version
- respect visibility
- be invalidated after material edits
- avoid inferring sensitive traits
- remain bounded by hard filters

---

# Match Score

The conceptual score may be expressed as:

```text
Match Score =
Activity Compatibility
+ Availability Compatibility
+ Location Compatibility
+ Participation Compatibility
+ Budget Compatibility
+ Recurrence Compatibility
+ Trust Adjustment
+ Friendship Adjustment
+ Previous Activity Adjustment
+ Semantic Similarity
- Risk Penalties
```

Hard filters are not score penalties.

They remove the candidate entirely.

---

# Recommended Score Structure

A production score should use normalized sub-scores.

Example:

```text
activity_score       0.00–1.00
availability_score   0.00–1.00
location_score       0.00–1.00
participation_score  0.00–1.00
budget_score         0.00–1.00
trust_score          0.00–1.00
semantic_score       0.00–1.00
risk_penalty         0.00–1.00
```

Example weighted formula:

```text
base_score =
  activity_score      × 0.30
+ availability_score  × 0.25
+ location_score      × 0.20
+ participation_score × 0.10
+ budget_score        × 0.05
+ trust_score         × 0.05
+ semantic_score      × 0.05

final_score =
  clamp(base_score - risk_penalty, 0, 1)
```

Weights are examples, not permanent product rules.

Every production calculation must store:

- algorithm version
- feature version
- calculated time
- source Intent update timestamps
- explanation codes

---

# Risk Penalties

Risk penalties may reduce ranking when policy allows the candidate to remain visible.

Examples:

- repeated late cancellation
- recent no-show pattern
- mass request behavior
- rapid duplicate Intent creation
- spam reports
- suspicious automation
- low-confidence identity
- recent unresolved safety concern

Some risk conditions should become hard filters instead.

Examples:

- active suspension
- block relationship
- severe safety restriction
- illegal Activity
- guardian policy failure
- explicit exclusion

Risk logic must be reviewed for fairness and false positives.

---

# Match Types

## Automatic Candidate Match

Generated by the system from compatible Intent records.

Status flow:

```text
active → accepted / dismissed / expired / invalidated
```

Automatic Match does not create a Plan.

---

## Participation Request

A Person requests connection using a source Intent.

Required relationships:

```text
requester Person
requester source Intent
receiver Person
receiver target Intent
```

Possible statuses:

- pending
- accepted
- rejected
- withdrawn
- expired
- cancelled

Acceptance may create or update a Plan.

---

## Direct Invitation

A Person invites another Person through an Intent.

Required relationships:

```text
inviter Person
source Intent
invitee Person
optional existing Plan
```

Possible statuses:

- pending
- accepted
- declined
- withdrawn
- revoked
- expired

Invitation acceptance must still pass:

- capacity
- restriction
- block
- visibility
- guardian
- lifecycle checks

---

## Friend-Visible Match

Friends may discover compatible Intent when visibility allows.

This is not a separate domain entity.

It is an automatic candidate with friendship-based visibility and a limited ranking adjustment.

---

# Match Lifecycle

The Match lifecycle must remain separate from Plan and Activity lifecycle.

```text
Candidate

↓

Active Match

↓

Request or Invitation

↓

Accepted Connection

↓

Plan Created or Updated

↓

Plan Forming

↓

Activity Planned

↓

Activity Completed

↓

Experience Created
```

Alternative Match paths:

```text
Candidate → Dismissed
Candidate → Expired
Candidate → Invalidated
Request → Rejected
Request → Withdrawn
Invitation → Declined
Invitation → Revoked
```

The Match record must not be labeled Completed merely because an Activity was completed.

Match history may reference the resulting Plan.

---

# Plan Formation

An accepted Request or Invitation may trigger controlled Plan formation.

The transaction should:

1. authenticate the actor

2. lock relevant Intent and Plan rows

3. re-evaluate visibility

4. re-evaluate blocks and restrictions

5. re-evaluate capacity

6. verify both Intent lifecycle states

7. create a Plan when none exists

8. attach the host-source Intent

9. attach the participant-source Intent

10. create active Plan memberships

11. update Match or Request status

12. create lifecycle events

13. create a Planning Room system message

14. create notifications

15. commit atomically

The client must not assemble this lifecycle through independent writes.

---

# Match Invalidation

A Match must be invalidated when a material source condition changes.

Examples:

- Activity Type changes
- date range changes
- location changes
- visibility changes
- owner blocks candidate
- recruitment closes
- Intent expires
- Intent is cancelled
- Intent links to a conflicting finalized Plan
- account becomes restricted
- guardian policy changes
- algorithm version is retired

Invalidation should preserve history.

The system should not physically delete Match history unless required by retention policy.

---

# Match Freshness

Match results become stale.

The engine should record:

- source Intent updated_at
- candidate Intent updated_at
- score calculated_at
- algorithm version
- visibility snapshot version where applicable

Before displaying or accepting a Match, the system should revalidate critical conditions.

High-risk actions require live checks even when a cached Match exists.

---

# Explainable Match Output

A Match explanation should use safe reason codes.

Examples:

- Same Activity Type
- Dates overlap
- Same district
- Both open to a small group
- Similar budget expectation
- Friend-visible Intent
- Previously completed an Activity together

The explanation must not reveal:

- private coordinates
- hidden age data
- moderation reports
- health data
- inferred sensitive traits
- exact trust formula
- internal fraud signals
- excluded-user lists

A Match may show:

```text
Walking
Kadıköy
18–20 July
Compatible date range
Same district
```

Owner information should be limited to what visibility policy allows.

---

# Discovery UI Rules

Discovery screens primarily display:

- Intent title
- Activity Type
- category
- availability
- location scope
- recurrence
- participant capacity
- visibility-safe owner summary
- Match explanation

They should not primarily display:

- profile popularity
- follower count
- profile-view count
- unrelated photos
- public engagement metrics
- infinite passive content

The primary action should be Intent-related:

- View Intent
- Request to Join
- Invite
- Use My Intent
- Open Match

Not:

- Swipe
- Follow Person
- Like
- Boost Profile

---

# Privacy

Privacy always overrides Match score.

A high score does not grant access.

The Match Engine must separately evaluate:

- discovery visibility
- owner profile visibility
- exact location visibility
- participant identity visibility
- room access
- managed minor access
- notification content

Access to one layer does not imply access to another.

---

# Safety

Safety evaluation may include:

- blocks
- active restrictions
- managed minor rules
- repeated harmful behavior
- category-specific safety requirements
- verified guardian authority
- age-appropriate Activity policy
- capacity
- location disclosure policy
- messaging permissions

Safety systems must avoid exposing private report details to Match participants.

Administrative overrides must be audited.

---

# Fairness

The Match Engine must be tested for unfair outcomes.

Review areas include:

- location disadvantage
- new-user disadvantage
- trust-score lock-in
- managed minor safety
- accessibility requirements
- language preference
- economic bias
- category underrepresentation
- model bias in semantic similarity
- false risk penalties

Fairness does not require ignoring legitimate safety or logistical constraints.

It requires understanding and controlling unintended exclusion.

---

# Cold Start

New users and new Intent records have limited history.

Cold-start matching should rely on:

- structured Intent fields
- explicit availability
- location
- visibility
- capacity
- verified identity where available
- semantic similarity

New users must not be buried merely because they lack Activity history.

Trust history may adjust ranking but must not be required for basic discovery unless safety policy demands it.

---

# Duplicate Intent Detection

Duplicate detection is adjacent to Match but is not a Match between people.

It may identify:

- same owner
- same Activity Type
- overlapping date range
- same location
- same recurrence
- same status

Possible actions:

- open existing Intent
- edit existing Intent
- create a distinct Intent
- create again from expired history

The system must not generate a self-Match from duplicate Intent records.

---

# Group Formation

A Plan may contain more than two people.

Group formation may evaluate:

- host-source Intent
- participant-source Intent compatibility
- remaining capacity
- schedule feasibility
- budget compatibility
- role balance
- accessibility
- safety
- existing member constraints

A candidate compatible with the host may still be incompatible with the active Plan.

Final admission should evaluate the Plan state, not only the original Match.

---

# Match Data Model

A target `intent_matches` record may include:

- id
- source_intent_id
- candidate_intent_id
- score
- status
- reason
- algorithm_version
- source_intent_version
- candidate_intent_version
- calculated_at
- expires_at
- accepted_at
- dismissed_at
- invalidated_at
- resulting_plan_id
- created_at
- updated_at

Rules:

- source and candidate Intent must differ
- normalized pair uniqueness should prevent duplicate active Matches
- result history should remain auditable
- resulting Plan is optional until acceptance

---

# Match API Responsibilities

A Match API or service layer may expose:

- list active Matches
- get Match details
- dismiss Match
- create participation Request
- withdraw Request
- accept Request
- reject Request
- send Invitation
- withdraw Invitation
- accept Invitation
- decline Invitation
- explain Match
- refresh stale Match
- list Match history

Read APIs must re-evaluate visibility.

Write APIs must use controlled transactional actions.

---

# AI Responsibilities

AI may:

- calculate semantic similarity
- normalize Intent wording
- suggest related Activity Types
- detect likely duplicates
- generate safe explanation text
- identify stale or inconsistent Intent
- suggest date or location clarification
- support group compatibility analysis

AI must not:

- bypass visibility
- create a Match across a block
- accept Requests
- send Invitations
- create a Plan without authorized action
- infer protected attributes
- reveal private data
- manipulate users with urgency
- optimize for swipes or time spent
- replace structured safety checks

AI output must be versioned, reviewable and reversible where practical.

---

# Performance and Indexing

Candidate generation should rely on indexes before expensive semantic operations.

Recommended indexes may include:

- Intent status
- matching status
- recruitment status
- Activity Type
- category
- date range
- city and district
- visibility
- owner
- updated_at
- active Match pair
- Match expiry

Semantic search should operate on an eligibility-filtered candidate set.

The system must avoid calculating every Intent against every other Intent.

---

# Background Jobs

Background jobs may:

- generate new candidate Matches
- refresh stale scores
- invalidate expired Matches
- rebuild semantic embeddings
- recalculate trust projections
- expire Requests and Invitations
- detect duplicate Intent
- update recommendation projections

Jobs must be:

- idempotent
- bounded
- observable
- retry-safe
- versioned
- privacy-aware

---

# Observability

The Match Engine should record operational metrics.

Examples:

- candidates generated
- hard-filter rejection counts
- score distribution
- stale Match count
- Match display count
- Request conversion
- Invitation conversion
- accepted connection count
- Plan formation success
- Plan formation failure reason
- Activity completion after Match
- safety block count
- latency
- job failure rate

Metrics must not expose raw private Intent text unnecessarily.

---

# Success Metrics

The Match Engine is evaluated by:

- accepted compatible connections
- Plans formed
- Activities finalized
- Activity completion rate
- attendance reliability
- repeat participation
- user-reported Match quality
- safety outcomes
- low invalidation after acceptance
- low accidental duplicate Request rate

It is not evaluated by:

- time spent
- swipe volume
- profile views
- follower growth
- public engagement
- notification opens without real-world outcome

The primary success metric should remain close to:

```text
Compatible Intent that became a completed real-world Activity
```

---

# Testing Strategy

## Unit Tests

Test:

- date overlap
- location scoring
- visibility
- block rules
- capacity
- recurrence
- budget compatibility
- score normalization
- explanation codes
- invalidation

## Integration Tests

Test:

- Match listing under RLS
- Request creation
- Invitation creation
- acceptance transaction
- Plan formation
- capacity race
- restriction enforcement
- managed minor approval
- Match invalidation after Intent edit
- stale Match revalidation

## Property Tests

Test invariants such as:

- blocked users never Match
- private Draft never Match
- cancelled Intent never Match
- full Plan never accepts beyond capacity
- Match never creates Activity directly
- accepted connection never creates Plan without source Intent

## Load Tests

Test:

- candidate generation at scale
- location filtering
- semantic ranking latency
- concurrent acceptance
- background refresh jobs
- index performance

---

# Migration Guidance

When removing legacy Match models:

1. inventory tables, functions, views and application calls

2. identify Organization-related Match records

3. identify direct Activity-creation paths

4. preserve required history

5. migrate Person-owned Intent links where valid

6. remove Organization actors from Match contracts

7. update RPC return types

8. update generated database types

9. invalidate stale Match projections

10. rebuild active Match candidates

11. run RLS and acceptance tests

12. verify that every resulting Plan has source Intent

Legacy Organization Match data must not remain active as a dormant feature.

---

# Match Engine Invariants

1. Intent always comes first.

2. Match primarily connects Intent to Intent.

3. Person-to-Intent discovery is not independent Person matching.

4. No Match exists without Intent.

5. No Organization actor exists.

6. No Place or Venue actor exists.

7. Visibility is evaluated before score.

8. Blocking overrides all Match logic.

9. Safety and guardian rules override score.

10. Hard filters remove candidates.

11. Capacity is rechecked transactionally.

12. Match never creates Activity directly.

13. Accepted connection may create or update a Plan.

14. Every resulting Plan has source Intent.

15. Final schedule belongs to Plan.

16. Activity begins only after Plan finalization.

17. Popularity is irrelevant.

18. Friendship is secondary.

19. Trust is contextual and bounded.

20. AI supplements structured rules.

21. Match explanations must not expose private data.

22. Stale Matches are revalidated.

23. Material Intent edits invalidate affected Matches.

24. Group admission evaluates current Plan state.

25. Success is measured by safe real-world execution.

---

# Final Principle

The Match Engine exists for one purpose:

To help compatible Intent records become a viable shared Plan under the right privacy, safety, timing and location conditions.

It does not optimize attention.

It helps people turn Intent into real life.
