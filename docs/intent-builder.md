# UIN Intent Builder

Version 2.0

---

# Purpose

The Intent Builder is the entry point of UIN.

Every meaningful product flow begins with a Person expressing an Intent.

The Builder transforms a human intention into structured, understandable, private-by-design and matchable data.

Without Intent, there is no:

- Match
- Request
- Invitation
- Plan
- Activity
- Experience

The Builder must never create an Activity directly.

The canonical lifecycle is:

```text
Person → Intent → Match / Request / Invitation → Plan → Activity → Experience
```

---

# Core Product Rules

1. Every account represents a Person.

2. Only a Person may create an Intent.

3. No Organization account, Organization profile or Organization Intent exists.

4. No Place or Venue account exists.

5. Location is metadata attached to an Intent and later refined inside a Plan.

6. The Builder creates Intent only.

7. Final date, time and meeting point belong to the Plan stage.

8. Activity exists only after a Plan is finalized.

9. Profile visibility never determines Intent visibility.

10. The Builder must support Tactical, Strategic and Telos Intent without forcing all three into the same field requirements.

---

# Builder Philosophy

Creating an Intent should feel easier than sending a long message.

The user should not need to understand the database model.

The Builder should:

- ask only what is necessary
- prefer selection over typing
- progressively disclose advanced options
- explain consequences before publication
- keep privacy decisions explicit
- avoid passive engagement mechanics
- preserve the user's original meaning

The Builder is not a social post composer.

It is not an Event creation form.

It is not an Activity scheduling form.

It is where human intention becomes structured enough for UIN to help it become real.

---

# Design Goals

The Intent Builder must be:

- fast
- simple
- guided
- structured
- mobile-first
- accessible
- privacy-aware
- lifecycle-aware
- AI-assisted
- resilient to partial completion
- safe for managed minor profiles
- compatible with future web and mobile clients

---

# Intent Types

Every Intent has one primary type.

## Tactical Intent

Represents a concrete intention within a near-term time horizon.

Examples:

- Walk in Kadıköy this weekend
- Visit a museum next week
- Join a basketball game this month
- Find someone to study with tomorrow

Typical fields:

- activity
- location
- date range
- participant preference
- visibility
- recurrence
- budget
- capacity

Tactical Intent is the primary source for Match and Plan creation.

---

## Strategic Intent

Represents a medium- or long-term direction that may generate multiple Tactical Intent records.

Examples:

- Improve conversational English this year
- Become physically active over the next six months
- Build a professional network in sustainability
- Learn photography through regular practice

Typical fields:

- title
- category
- goal
- target date or date range
- optional location scope
- visibility
- optional child Intent relationship

Strategic Intent may:

- remain personal
- become visible for inspiration
- generate child Tactical Intent
- connect to compatible people or journeys
- contribute to portfolio history

It does not need to become a single Activity.

---

## Telos Intent

Represents an enduring direction or life orientation.

Examples:

- Live more intentionally
- Contribute to accessible education
- Build a life centered on creative work
- Raise children with curiosity and courage

Typical fields:

- title
- statement
- life theme
- visibility
- optional related Strategic Intent

Telos Intent:

- may have no end date
- may never be completed
- does not require activity, location, budget or participant capacity
- gives direction to Strategic and Tactical Intent
- may be private

Telos is still an Intent.

It is not a biography field, slogan or profile badge.

---

# Intent Classification

Intent type should be selected explicitly by the user or suggested by the system.

The system may recommend a type based on:

- time horizon
- wording
- recurrence
- specificity
- whether the Intent describes an action, goal or enduring direction

AI may suggest classification.

The user remains the final decision-maker.

Recurrence is not an Intent type.

Terms such as `recurring`, `flexible`, `open` or `scheduled` describe other properties and must not replace Tactical, Strategic or Telos.

---

# Builder Entry Modes

The Builder may open in one of four modes.

## New Intent

Starts a blank Intent.

## Create Again

Copies safe fields from a previous Intent.

May copy:

- activity type
- category
- location scope
- participant preference
- recurrence
- visibility
- notes

Must not copy without review:

- expired date range
- accepted participants
- Plan membership
- final schedule
- meeting point
- conversation
- attendance
- reputation outcomes

## Child Intent

Creates a Tactical or Strategic Intent linked to a parent Strategic or Telos Intent.

## AI-Assisted Draft

Starts from natural language and converts it into proposed structured fields.

The user must review all extracted fields before publication.

---

# High-Level Builder Flow

```text
Choose Intent Type

↓

State the Intent

↓

Choose Category and Activity

↓

Choose Availability

↓

Choose Location Scope

↓

Choose Participation Preference

↓

Choose Budget and Capacity

↓

Choose Visibility

↓

Add Optional Details

↓

Review Consequences

↓

Publish Intent
```

The exact steps vary by Intent type.

Telos Intent must not be forced through Activity, location, budget or participant steps.

---

# Step 1 — Choose Intent Type

Options:

- Tactical
- Strategic
- Telos

Each option should have a brief explanation and example.

Example copy:

### Tactical

A concrete action you want to take.

### Strategic

A longer-term goal that may lead to several actions.

### Telos

An enduring direction that guides your life and choices.

The Builder should not present internal database terminology.

---

# Step 2 — State the Intent

Fields:

- title
- optional short description

Examples:

- Walk in Kadıköy this weekend
- Practice English every Tuesday
- Become more physically active
- Build a life centered on meaningful work

Rules:

- Title should be concise.
- Description is optional.
- Long text should not be required.
- The system may improve clarity without changing meaning.
- The original user text may be preserved for audit or draft recovery when appropriate.

Validation:

- title is required
- title length must be bounded
- unsupported markup must be rejected
- empty or meaningless titles must not be published

---

# Step 3 — Choose Category and Activity

## Category

Examples:

- Sports
- Cultural Event
- Education
- Volunteering
- Travel
- Family
- Entrepreneurship
- Nature
- Social
- Creativity
- Career
- Wellbeing

## Activity Type

Examples:

- Walking
- Running
- Basketball
- Theatre
- Concert
- Workshop
- Museum Visit
- Language Exchange
- Study Session
- Volunteering
- Photography
- Camping

Rules:

- Predefined Activity Types are preferred.
- Activity Type is taxonomy, not a scheduled Activity.
- Selecting Walking does not create a Walking Activity.
- Tactical Intent normally requires an Activity Type.
- Strategic Intent may use a broad category without a specific Activity Type.
- Telos Intent does not require either.
- Custom Activity Types require moderation or controlled normalization before becoming shared taxonomy.

The product should avoid duplicate values caused by spelling variations.

---

# Step 4 — Choose Availability

Intent availability defines a date window.

It does not define the final Activity schedule.

Supported input:

- today
- tomorrow
- this weekend
- next week
- specific date
- date range
- flexible date range
- recurring availability

Stored values should resolve to:

- start date
- end date
- recurrence rule or recurrence label

Examples:

- 18 July 2026
- 18–20 July 2026
- Every Tuesday during August
- Any weekend this month

Rules:

- Tactical Intent requires a valid date or date range.
- End date may not be before start date.
- Time of day is not required at Intent stage.
- Exact start and end time are decided in the Plan.
- Strategic Intent may use a broader target period.
- Telos Intent may omit dates.
- Expiration is distinct from cancellation.

The Builder must not ask for a final meeting time before a Plan exists.

---

# Step 5 — Choose Location Scope

Location is Intent metadata.

Supported input:

- current city
- district
- neighborhood
- address
- map selection
- Google Place result
- online
- flexible area
- travel radius

Examples:

- Kadıköy, İstanbul
- Within 5 km
- İstanbul
- Online
- Location to be decided in Plan

Possible stored fields:

- country
- city
- district
- neighborhood
- address text
- latitude
- longitude
- Google Place ID
- location source
- radius

Rules:

- Location has no account or profile.
- The Builder must not create a Venue entity.
- Tactical Intent should normally have enough location data for matching.
- Exact address may remain hidden until participation is accepted.
- The Plan may refine or replace the Intent location.
- Final meeting point belongs to the Plan.
- Street View and map previews are presentation features based on location metadata.
- Latitude and longitude should not be shown as normal user-facing fields unless manually entering coordinates is explicitly needed.

---

# Step 6 — Choose Participation Preference

The Builder asks how the user imagines carrying out the Intent.

Possible values:

- alone
- with friends
- with partner
- with child
- with family
- with one other person
- with a small group
- open to compatible people

This field expresses preference.

It is not the same as Plan membership.

Rules:

- An Intent may be valid for solo completion.
- A solo Intent does not require Match.
- Managed minor participation may require guardian approval.
- Preferences must not silently become discriminatory filters.
- Safety-sensitive restrictions must be explicit and justified.

---

# Step 7 — Choose Capacity

Capacity applies when the user is open to forming a shared Plan.

Fields:

- maximum participants
- optional preferred participant count

Examples:

- 1 additional person
- 2 additional people
- up to 5 participants
- unlimited

Rules:

- The Builder must clearly distinguish host from participants.
- The Person who owns the host-source Intent must not be counted twice.
- Capacity is enforced transactionally at Plan stage.
- Intent capacity is an initial preference and may be refined in the Plan.
- Unlimited capacity must be represented explicitly, not as an arbitrary large number.
- Capacity must be greater than zero when provided.

---

# Step 8 — Choose Budget

Budget is optional.

Possible inputs:

- no defined budget
- personal budget
- budget range
- contribution amount
- free activity

Rules:

- Intent budget represents the owner's initial personal expectation.
- It is not the final Activity budget.
- Plan members may add budget commitments later.
- Plan target budget and committed budget belong to Plan coordination.
- Budget must not be negative.
- Currency must be explicit when multi-currency support is introduced.
- Budget visibility should follow Intent and Plan privacy rules.

---

# Step 9 — Choose Visibility

Intent visibility is independent from profile visibility.

Supported options:

- Public
- Friends
- Close Friends
- Selected Users
- Everyone Except Selected Users
- Invitation Only
- Private Draft

Internal values may include:

- public
- friends_only
- close_friends_only
- selected_users
- exclude_selected_users
- invite_only
- private_draft

Rules:

- Every Intent owns its own visibility.
- Profile visibility does not override Intent visibility.
- Blocking overrides all visibility rules.
- Public visibility does not automatically expose exact location.
- Private Draft must not enter Match, search or recommendation systems.
- Visibility changes must invalidate affected Match and search projections.
- The review step must explain who can discover the Intent and who can request participation.

---

# Step 10 — Optional Details

Optional details may include:

- short notes
- accessibility requirements
- equipment needed
- language preference
- experience level
- child-friendly
- pet-friendly
- indoor or outdoor preference
- transportation considerations

Rules:

- Optional details should remain optional.
- Safety requirements may be mandatory when legally or operationally necessary.
- Sensitive characteristics must not become careless discovery filters.
- Free-text notes must not override structured safety or visibility policy.
- Requirements must not expose private health or identity data by default.

---

# Managed Minor Rules

A managed minor profile may have a restricted Builder.

Possible rules:

- independent Intent creation disabled
- Intent draft allowed but guardian publication required
- participation-only mode
- guardian-managed visibility
- guardian approval required before invitation acceptance
- exact location hidden until authorized

The active rule set must be enforced server-side.

UI restrictions alone are insufficient.

Guardian actions must be audited.

---

# Review Screen

Before publication, the Builder shows a structured summary.

The review screen should include:

- Intent type
- title
- category
- Activity Type
- availability
- location scope
- recurrence
- participation preference
- capacity
- budget
- visibility
- optional details

It must also explain:

- who can discover the Intent
- whether people may send requests
- whether invitations may be sent
- whether exact location is hidden
- when the Intent will expire
- that no Activity has been created yet
- that final schedule is decided only after a Plan is formed

Primary action:

```text
Publish Intent
```

Not:

```text
Create Activity
```

---

# Publishing

Publishing an Intent should be a controlled server-side action.

The action should:

1. authenticate the Person

2. verify account restrictions

3. validate all required fields

4. validate visibility

5. validate managed minor policy

6. normalize taxonomy and location references

7. insert or update the Intent

8. create an Intent lifecycle event

9. create or invalidate Match projections

10. return the published Intent identifier

Publishing must not:

- create an Activity directly
- create Plan membership
- confirm participants
- expose exact location beyond policy
- bypass account restrictions

---

# Drafts

Draft Intent supports incomplete work.

Draft behavior:

- autosave when practical
- private by default
- excluded from Match
- excluded from search
- excluded from recommendations
- editable without lifecycle side effects
- recoverable after interruption

Possible statuses:

- draft
- active
- planned
- completed
- cancelled
- archived

Expiration is tracked separately from explicit cancellation when the implementation uses `expired_at`.

---

# Editing

Editable fields may include:

- title
- description
- activity type
- category
- date range
- recurrence
- location scope
- participant preference
- capacity
- budget
- visibility
- optional details

Edits may trigger:

- Match recalculation
- invitation invalidation
- request revalidation
- notification
- Plan compatibility review
- search projection rebuild

Rules:

- Editing a source Intent must not silently rewrite a finalized Plan.
- Final Activity schedule is edited in the Plan, not the Intent Builder.
- Material changes should create lifecycle events.
- Changes to visibility take effect immediately.
- Edits must respect active Plan relationships.

---

# Duplicate Detection

The Builder should identify likely duplicate Intent records.

Example:

```text
You already have an open Walking Intent in Kadıköy for this weekend.
```

Possible actions:

- open existing Intent
- edit existing Intent
- create a distinct Intent anyway
- create again from an expired Intent

Duplicate detection may consider:

- owner
- Activity Type
- location
- overlapping dates
- recurrence
- status
- visibility

The system should not merge Intent records automatically.

---

# Create Again

Expired, completed or cancelled Intent may support Create Again.

Create Again should:

- create a new Intent identifier
- preserve historical records
- copy safe reusable fields
- require a new date review
- reset status
- reset requests and invitations
- reset Plan links
- reset attendance and Experience data

It must not reopen or mutate the historical Intent.

---

# AI Assistance

AI may assist with:

- Intent type suggestion
- title clarification
- category suggestion
- Activity Type suggestion
- location normalization
- date-range interpretation
- recurrence suggestion
- duplicate detection
- visibility explanation
- accessibility prompt suggestions
- natural-language draft creation

AI must not:

- publish without user confirmation
- create an Activity directly
- invent exact location
- infer sensitive personal attributes
- weaken visibility
- add participants
- send invitations
- accept requests
- make guardian decisions
- change Telos meaning
- replace the user's intent with a more engagement-friendly version

AI assistance must be explainable and reversible.

---

# Smart Suggestions

Useful suggestions may include:

- You already have a similar open Intent.
- Your selected date range has ended.
- This activity usually needs a more specific district for matching.
- You can decide the exact time later in the Planning Room.
- Your visibility allows public discovery, but the exact meeting point will remain protected.
- This Strategic Intent could be supported by a Tactical Intent.
- This Intent may work as a recurring weekly Intent.

Suggestions should:

- remain dismissible
- avoid interrupting the flow
- avoid urgency manipulation
- avoid false scarcity
- avoid social-pressure language

Current external facts such as weather, venue opening hours or travel time must be sourced from current providers rather than guessed.

---

# Templates

Templates reduce repeated work.

Examples:

- Morning Walk
- Weekend Museum Visit
- Weekly Basketball
- Study Together
- Language Exchange
- Volunteer Activity
- Family Nature Walk
- Photography Practice

A template stores default field suggestions.

A template is not an Intent until the user reviews and publishes it.

Templates must not carry:

- active participants
- Plan members
- exact past schedule
- old messages
- attendance
- Experience
- reputation outcomes

---

# Validation by Intent Type

## Tactical Intent Required Fields

- Intent type
- title
- category
- Activity Type
- availability start date
- availability end date
- location scope sufficient for matching
- visibility

Conditionally required:

- capacity when open to group participation
- guardian approval when managed minor policy requires it

## Strategic Intent Required Fields

- Intent type
- title
- category or life domain
- target period or explicit ongoing state
- visibility

Optional:

- Activity Type
- location
- recurrence
- parent Telos Intent

## Telos Intent Required Fields

- Intent type
- title or statement
- visibility

Optional:

- life theme
- related Strategic Intent
- private notes

Telos must not require:

- Activity Type
- date range
- location
- participant capacity
- budget

---

# Intent Lifecycle

The lifecycle must distinguish Intent, Plan and Activity.

```text
Draft Intent
    ↓
Active Intent
    ↓
Match / Request / Invitation
    ↓
Shared Plan Forming
    ↓
Planned Activity
    ↓
Completed Activity
    ↓
Experience
    ↓
Portfolio Integration
```

Alternative paths:

```text
Active Intent → Expired
Active Intent → Cancelled
Active Intent → Archived
Forming Plan → Expired
Forming Plan → Cancelled
Planned Activity → Cancelled
```

Rules:

- Match does not automatically create an Activity.
- Accepted participation should create or update a Plan through a controlled action.
- Finalizing the Plan creates the Planned Activity state.
- Completion requires Activity outcome and attendance handling.
- Experience belongs after Activity completion.

---

# Builder Analytics

Allowed analytics:

- Builder opened
- step completed
- validation failed
- draft saved
- Intent published
- duplicate suggestion shown
- duplicate suggestion accepted
- Builder abandoned
- AI suggestion accepted or rejected

Analytics must not store unnecessary free-text content.

Builder optimization must focus on:

- successful Intent expression
- validation clarity
- completion without confusion
- privacy comprehension
- reduced accidental duplicates

It must not optimize for:

- maximum publication volume
- compulsive return
- unnecessary notifications
- passive scrolling
- public exposure

---

# Accessibility

The Builder must support:

- keyboard navigation
- screen readers
- visible focus states
- clear field labels
- descriptive validation errors
- sufficient contrast
- reduced-motion preferences
- touch-friendly controls
- non-map alternatives for location entry
- date input alternatives
- plain-language privacy explanations

Map selection must never be the only way to provide location.

---

# Error Handling

The Builder must preserve user input when errors occur.

Errors should be:

- specific
- actionable
- attached to the relevant field
- written in plain language
- safe from leaking internal database details

Examples:

- End date cannot be before start date.
- Choose who can discover this Intent.
- This Intent can no longer be edited because its Plan is finalized.
- Your account currently cannot publish new Intent.
- Guardian approval is required before this Intent can be published.

---

# Security Rules

The Builder must not trust client-side validation.

Server-side validation must enforce:

- authenticated Person ownership
- account status
- field constraints
- visibility rules
- guardian policy
- capacity constraints
- allowed taxonomy
- safe location disclosure
- valid lifecycle transition
- rate limits
- duplicate pending-action prevention

Free-text fields must be sanitized for safe display.

---

# Future Improvements

Possible future improvements:

- natural-language Intent creation
- voice-based Intent creation
- calendar integration
- weather-aware suggestions
- travel-time estimates
- habit-aware recurrence suggestions
- multilingual Intent normalization
- semantic duplicate detection
- Strategic-to-Tactical decomposition
- Telos alignment suggestions
- accessible map and place search
- offline draft recovery
- collaborative Plan drafting after Intent connection

Explicitly excluded:

- Organization Intent Builder
- Place-owned Intent
- Venue-owned Intent
- direct Event creation
- direct Activity creation
- Activity creation without source Intent
- social post composer
- engagement-driven feed publishing

---

# Builder Principles

1. Intent before Activity.

2. Person before account type.

3. Selection before typing.

4. Availability before final schedule.

5. Location metadata before Place entities.

6. Privacy before discovery.

7. Clarity before feature density.

8. Real life before screen time.

9. Trust before Match.

10. User meaning before AI optimization.

11. Plan before Activity.

12. Experience after completion.

---

# Final Principle

The Intent Builder is not merely a form.

It is the controlled entry point where a Person's intention becomes structured enough to be matched, coordinated through a Plan and eventually lived as a real-world Activity.

Every Match, Plan, Activity and Experience begins with Intent.
