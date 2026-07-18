# UIN UI System

Version 2.0

---

# Purpose

This document defines the product interface rules for UIN.

UIN is an Intent Network.

The interface must support one canonical lifecycle:

```text
Person → Intent → Match / Request / Invitation → Plan → Activity → Experience
```

Every screen, card, navigation item and action must map clearly to this lifecycle.

The UI must not introduce alternate product models through wording, navigation or visual hierarchy.

UIN is not:

- a social media feed
- a dating interface
- an Event marketplace
- an Organization platform
- a Venue platform
- a content engagement product

---

# Permanent UI Rules

1. Every account represents a Person.

2. No Organization account switcher exists.

3. No Organization profile, Organization dashboard or Organization invitation UI exists.

4. No Venue or Place profile exists.

5. Location is shown as metadata, map context or meeting-point information.

6. No standalone Activity creation button exists.

7. The primary creation action is always `Create New Intent`.

8. A Plan is formed only from one or more Intent records.

9. Activity UI appears only after Plan lifecycle progression.

10. Profile pages are Intent biographies, not social profiles.

11. Match UI is Intent-first.

12. Participant identities are private unless visibility permits.

13. Managed minor interfaces use stricter privacy and guardian controls.

14. Reputation is shown quietly and contextually.

15. No likes, follower counts, public reactions, stories, reels or infinite engagement feeds exist.

16. One primary action should dominate each screen.

17. UI labels must match database and lifecycle terminology.

18. Empty, loading, error and restricted states are first-class product states.

19. Mobile behavior is designed before desktop expansion.

20. Accessibility is mandatory.

---

# Product Language

Use the following canonical terms:

- Person
- Profile
- Intent
- Match
- Request
- Invitation
- Plan
- Planning Room
- Activity
- Activity Room
- Experience
- Reflection
- Participant
- Primary Host
- Co-host
- Guardian
- Managed Profile

Avoid ambiguous or obsolete terms:

- Organization
- Organizer account
- Venue account
- Event creator
- Event listing
- Hosted Activity
- Organization invitation
- Community account
- Company account
- Venue owner
- Place owner

Use `Primary Host` or `Host` when referring to a Person coordinating a Plan.

Use `Activity Type` when referring to taxonomy such as Walking, Theatre or Basketball.

Use `Activity` only for a planned or executed real-world lifecycle state.

---

# UI Philosophy

UIN is designed to reduce digital noise and increase real-world action.

The interface should feel:

- calm
- clear
- human
- trustworthy
- purposeful
- restrained
- action-oriented

The interface should not feel:

- addictive
- noisy
- competitive
- performative
- popularity-driven
- content-heavy
- promotional

Every screen should help answer one of these questions:

```text
What do I intend to do?
What compatible Intent exists?
What decision requires my attention?
What are we planning?
What Activity is scheduled?
What did I experience?
```

---

# Design Principles

## Intent First

Intent is the primary content object.

The UI should display Intent before profile popularity or unrelated personal information.

---

## Lifecycle Clarity

Users must always understand whether they are viewing:

- an Intent
- a Match
- a Request
- an Invitation
- a forming Plan
- a Planned Activity
- a Completed Activity
- an Experience

The same visual component must not use conflicting terminology.

---

## Action Over Content

The UI should prioritize meaningful actions:

- Create Intent
- View Match
- Send Request
- Accept Invitation
- Open Planning Room
- Finalize Plan
- Open Activity Room
- Review Attendance
- Add Reflection

It should not prioritize passive browsing.

---

## Calm Interface

Use whitespace, clear hierarchy and limited simultaneous actions.

Do not fill screens merely because space exists. Humans already invented dashboards with fifteen charts and then wondered why nobody understood them.

---

## Privacy by Default

Visibility must be understandable at the point of creation and viewing.

Exact location, participant identity, managed minor details and private reflections require stronger protection than general discovery.

---

## Accessible by Design

Accessibility is not a later polish phase.

Every core action must support:

- keyboard navigation
- screen readers
- visible focus
- sufficient contrast
- touch interaction
- plain-language errors
- reduced motion
- non-map alternatives
- readable text scaling

---

# Visual Identity

## Brand Character

UIN should communicate:

- intentional action
- possibility
- movement
- trust
- human connection
- real-world participation

The brand should not resemble:

- a nightlife Event marketplace
- a dating application
- a corporate collaboration suite
- a creator economy product
- a gamified habit tracker

---

## Logo

The UIN logo may appear in:

- authentication
- Timeline header
- compact mobile header
- marketing pages
- loading or empty states where appropriate

The logo must not consume excessive vertical space on repeated workflow screens.

Application screens should prioritize task context over branding repetition.

---

# Color System

## Primary

UIN Green represents:

- Intent creation
- positive action
- active matching
- primary progression
- successful connection

Use for:

- primary buttons
- active Intent states
- compatible Match accents
- successful actions
- selected navigation where appropriate

---

## Lifecycle Accent Colors

Recommended semantic use:

- Green: active, open, compatible, successful
- Blue: Plan, scheduling, Activity information
- Cyan: participation and shared coordination
- Purple: completed, Experience, reflection
- Amber: action required, full capacity, caution
- Orange: expired
- Red: cancelled, rejected, destructive, restricted
- Gray: closed, inactive, secondary, historical

Color must not be the only status signal.

Every colored state must include text or an icon with accessible labeling.

---

## Neutral Colors

Use:

- white
- soft gray
- dark gray
- near-black

Avoid excessive pure black blocks and unnecessary gradients.

Gradients may support cover areas or identity headers, but must not reduce readability.

---

## Dark Mode

Dark mode should be supported when the design system is stable.

Rules:

- preserve semantic contrast
- avoid neon colors
- maintain readable cards and borders
- preserve status meaning
- test maps, photos and overlays
- avoid pure black backgrounds where softer dark neutrals improve comfort

---

# Typography

Typography should prioritize legibility.

Recommended hierarchy:

- Display
- Page Heading
- Section Heading
- Card Title
- Body
- Supporting Text
- Caption
- Status Label

Rules:

- avoid decorative fonts
- use bounded heading sizes
- preserve line length
- avoid excessive uppercase
- uppercase may be used for short section labels
- body text should remain readable at mobile widths
- status text should not be tiny merely to fit crowded cards

---

# Spacing and Layout

## General Rules

- Use consistent spacing tokens.
- Prefer vertical rhythm over dense grids.
- Avoid horizontal overflow.
- Keep primary content centered with readable maximum widths.
- Use cards for bounded lifecycle objects.
- Use full-width sections only when the task requires it.
- Do not place critical actions below unrelated decorative content.

---

## Mobile

Mobile is the default design target.

Rules:

- single-column primary flow
- large touch targets
- sticky actions only when they do not hide content
- compact navigation
- cards stack vertically
- long labels wrap safely
- maps have non-map alternatives
- modal use remains limited
- destructive confirmations remain explicit

---

## Tablet

Tablet may expand:

- Planning Room
- member and conversation views
- Activity details
- guardian workspace
- portfolio
- admin review

Tablet must not introduce Organization or multi-account business management patterns.

---

## Desktop

Desktop may support:

- wider Timeline layout
- side-by-side Plan information
- richer Planning Room
- admin moderation
- analytics for product operators
- larger map and participant views

Desktop is not a license to fill every empty region with controls.

---

# Navigation Model

## Primary Navigation

Primary navigation should remain lifecycle-oriented.

Recommended top-level destinations:

- Timeline
- Matches
- Inbox
- Notifications
- Profile

The primary creation action remains:

```text
Create New Intent
```

---

## Timeline Header

The Timeline header may include:

- UIN logo
- page title
- signed-in email or Person identifier
- personal context
- managed profiles when authorized
- Create New Intent
- Matches
- Inbox
- Notifications
- account menu

The account context switcher may contain:

- Personal
- Managed Profiles

It must not contain:

- Organizations
- Organization invitations
- Organization management
- Create Organization
- Venue accounts

---

## Account Menu

May include:

- My Profile
- Profile Settings
- Family and Age Settings
- Admin Dashboard when authorized
- Sign Out

Must not include obsolete account-type switching.

---

## Back Navigation

Workflow pages should include clear back navigation.

Examples:

- Back to Timeline
- Back to Matches
- Back to Inbox
- Back to Planning Room
- Back to Activity

Avoid relying only on browser history for core navigation.

---

# Timeline

## Purpose

Timeline is the user's lifecycle overview.

It should answer:

```text
What Intent do I have?
What shared Plans am I part of?
What Activities are scheduled?
What requires action?
What has been completed?
```

---

## Timeline Sections

Recommended lifecycle groups:

### Intents

- Open
- Full
- Closed

### Activities and Plans

- Participating
- Planned
- Action Required
- Completed
- Expired
- Cancelled

The UI may visually distinguish Intent-stage and Plan/Activity-stage sections.

---

## Timeline Card Types

- Intent Card
- Forming Plan Card
- Planned Activity Card
- Action Required Card
- Completed Activity Card
- Expired History Card
- Cancelled Activity Card

A card should not represent two lifecycle types without a clear label.

---

## Timeline Counts

Counts should represent actionable or visible records accurately.

Rules:

- counts must come from the same lifecycle logic used to display cards
- hidden or unauthorized records must not affect counts
- expired and cancelled are distinct
- host must not be counted twice
- notification counts and Inbox counts must remain separate

---

# Intent Card

## Required Content

An Intent Card may display:

- Intent owner role
- Intent type
- Activity Type
- category
- availability
- location scope
- participant preference
- recurrence
- budget
- visibility
- capacity
- recruitment status
- matching status
- pending request count

---

## Primary Actions

Depending on lifecycle:

- Edit Intent
- Manage Visibility
- Invite People
- Close Recruitment
- Reopen Recruitment
- Cancel Intent
- Create Again
- View Requests

No Intent Card should offer:

- Create Activity directly
- Publish Event
- Convert to Organization Activity
- Assign Venue owner

---

## Intent Status Labels

Recommended labels:

- Draft
- Open
- Full
- Closed
- Planned
- Completed
- Cancelled
- Expired
- Archived

Status labels must align with backend state.

---

# Create Intent Screen

## Purpose

Create Intent is the most important creation flow.

It must create only an Intent.

Primary action:

```text
Publish Intent
```

Not:

```text
Create Activity
Create Event
Host Activity
```

---

## Builder Structure

Recommended steps:

1. Intent Type
2. Intent statement
3. Category and Activity Type
4. Availability
5. Location scope
6. Participation preference
7. Capacity and budget
8. Visibility
9. Optional details
10. Review

The exact flow may adapt by Intent type.

Telos Intent must not be forced through Activity, location, capacity or budget fields.

---

## Coordinates

Latitude and longitude should not appear as normal form fields.

They may be stored internally after:

- map selection
- Google Places selection
- current location permission
- imported location metadata

Manual coordinate input belongs only in an advanced or administrative context.

---

## Cover Images

Intent and Activity presentation may support a cover image URL or upload.

Rules:

- image is optional
- external image URLs must be validated
- upload and URL input should be clearly distinguished
- broken-image fallback is required
- images must not override lifecycle information
- alt text or decorative treatment must be correct
- unsafe remote hosts must not be accepted blindly

A Plan or Activity may inherit an Intent cover image, but inheritance must remain explicit and editable where policy allows.

---

# Match Screen

## Purpose

Matches shows compatible Intent, not a gallery of people.

## Match Card Priority

Display in this order:

1. Intent
2. Activity Type
3. availability
4. location scope
5. compatibility reasons
6. capacity or participation context
7. visibility-safe owner summary
8. trust summary when relevant

---

## Match Actions

Possible actions:

- View Intent
- Request to Join
- Use My Intent
- Invite
- Dismiss Match

Avoid:

- Swipe
- Like
- Follow Person
- Boost
- Super Match
- Popular

---

## Match Explanation

Use safe explanations:

- Same Activity Type
- Dates overlap
- Same district
- Similar participation preference
- Compatible budget
- Friend-visible Intent
- Previous successful Activity

Do not reveal:

- exact private coordinates
- hidden age data
- report history
- internal risk score
- excluded-user lists
- sensitive inferred traits

---

# Inbox

## Purpose

Inbox contains items requiring a decision.

Notifications report updates and remain separate.

## Inbox Sections

- Intent Requests
- Activity Invitations
- Join Requests
- Guardian Actions

No Organization Invitation section exists.

---

## Inbox Cards

Each card should show:

- title
- plain-language description
- pending count
- destination
- clear Open action

The total pending count must equal actionable items represented by the screen.

---

# Requests

## Request Views

Recommended tabs or sections:

- Incoming
- Sent
- Accepted
- Rejected
- Withdrawn
- Expired

Incoming should appear first when it requires action.

---

## Request Actions

Incoming:

- Accept
- Reject

Sent:

- Withdraw

Accepted:

- Open Planning Room when a Plan exists

Rejected:

- historical state only, unless product policy explicitly allows a new request

Actions must show immediate and persistent state changes.

---

# Invitations

## Intent Invitations

Show:

- inviter
- source Intent
- Activity Type
- availability
- location scope
- message
- expiration
- Accept
- Decline

Acceptance must explain whether a Plan will be created or joined.

---

## Managed Profile Invitations

Show:

- child profile
- inviting Person
- source Intent
- Activity context
- guardian decision
- supervising guardian
- expiration

Sensitive minor details must remain protected.

---

# Planning Room

## Purpose

Planning Room coordinates a forming Plan.

It is not an Activity page yet.

## Primary Sections

Recommended order:

1. Plan summary
2. Members
3. Conversation
4. Budget
5. Schedule draft
6. Location and meeting point draft
7. Recruitment controls
8. Finalization

Members and Conversation should not be buried below a giant form.

---

## Members

Display:

- Primary Host
- Co-host
- Participants
- active status
- withdrawal status where historically relevant
- budget commitment
- guardian supervision when authorized

The Primary Host must not appear twice.

---

## Member Actions

Depending on authorization:

- assign Co-host
- remove participant
- update budget commitment
- withdraw
- invite participant
- close recruitment
- reopen recruitment

Destructive actions require confirmation.

---

## Conversation

Conversation should support:

- text messages
- system messages
- unread state
- timestamps
- sender identity
- accessible input
- safe moderation reporting
- loading and retry states

System messages may include:

- member joined
- member withdrew
- member removed
- schedule updated
- budget updated
- recruitment closed
- Plan finalized
- Activity cancelled
- Activity completed

---

## Schedule Draft

Fields may include:

- proposed date
- proposed start time
- proposed end time
- timezone
- meeting point
- notes

Rules:

- draft remains editable while forming
- exact time belongs here, not Intent creation
- timezone is visible
- validation explains conflicts
- finalization remains a distinct action

---

## Finalization

Preferred action label:

```text
Finalize Plan
```

Supporting explanation:

```text
This will create the Planned Activity state and close incompatible matching paths.
```

Avoid ambiguous labels such as:

- Publish Event
- Create Activity
- Launch Activity

Finalization requires confirmation.

---

# Activity Screen

## Purpose

Activity Screen represents a finalized Plan.

It may be reached through:

- Plan detail
- Activity Room
- public Activity route where visibility permits

## Required Content

- title
- Activity Type
- category
- Primary Host
- Co-hosts
- schedule
- timezone
- meeting point
- location map
- Street View when available
- participant count
- visible participants
- budget summary
- status
- Activity Room
- completion state

---

## Cover Image

The cover image should appear consistently on:

- Activity detail
- relevant Timeline card
- public Activity preview
- host profile Activity summary when visibility permits

Fallback behavior is required when no cover exists.

---

## Map and Street View

Map display may appear when location metadata exists.

Street View may appear when:

- provider supports it
- coordinates or Place ID are valid
- privacy allows exact location disclosure
- the user is authorized

Rules:

- unauthorized users see a reduced location scope
- map loading failure must not block the page
- textual address remains available
- external map links should be labeled
- location precision changes after acceptance must update safely

---

## Activity Room

Activity Room continues the same Plan conversation after finalization.

It should include:

- conversation history
- current schedule
- meeting point
- members
- system updates
- cancellation or reschedule notice
- completion prompt
- reflection entry after completion

The Planning Room must not disappear into an inaccessible archive.

---

# Completion Screen

## Purpose

Completion resolves attendance and Activity outcome.

## Host or Co-host Actions

- review participants
- mark attended
- mark no-show
- mark cancelled
- add optional completion note
- complete Activity

Rules:

- attendance decisions are auditable
- managed minor attendance is protected
- completion confirmation is explicit
- scheduled end should normally have passed
- unresolved attendance is handled visibly

---

## Participant View

Participants may see:

- Activity waiting for completion
- their attendance outcome
- dispute path where supported
- reflection action after completion

Participants must not edit other members' attendance.

---

# Experience and Reflection

## Experience Screen

May show:

- completed Activity
- personal attendance
- summary
- would-repeat
- visibility
- portfolio state
- reflection

Experience is personal.

It must not expose another participant's identity without permission.

---

## Reflection Screen

Questions may include:

- How was it?
- Would you do it again?
- What would you change?
- Optional private note
- Optional public reflection

Private is the default.

No public comment thread should emerge from reflections.

---

# Profile Screen

## Purpose

Profile is an Intent biography.

It is not a social content profile.

## Profile Content

May include:

- avatar
- cover
- full name
- username
- bio
- public Intent
- planned Activities
- completed Activities
- public Experiences
- life themes
- trust summary
- portfolio metrics

Must not include:

- Organization memberships
- follower count
- public like count
- profile-view count
- unrelated content feed
- popularity rank

---

## Profile Metrics

Metrics may include:

- active Intent
- planned Activities
- completed Activities
- public Experiences

Metrics must reflect visible data.

Private records must not inflate public counts.

---

## Report Action

Profile reporting should include:

- target label
- target type
- clear reason selection
- optional details
- confirmation
- privacy explanation

---

# Managed Profile UI

## Managed Child Timeline

May show:

- child identity
- guardian-managed status
- accepted guardians
- limited profile actions
- participation restrictions
- guardian-required explanation

Must not show:

- Organization roles
- public numerical reputation
- exact private location
- unrestricted independent Intent creation

---

## Guardian Workspace

May include:

- Pending
- Approved
- Declined
- Past

Invitation cards may show:

- inviting Person
- Activity Type
- availability
- location scope
- message
- guardian action
- supervising guardian
- Planning Room link after acceptance

---

## Family Settings

May include:

- profile age settings
- Primary Guardian
- Guardian
- permissions
- invitation status
- revoke action
- managed profile settings

All sensitive actions require confirmation and server-side enforcement.

---

# Notifications

## Allowed Notification Categories

- Match found
- Request received
- Request accepted
- Invitation received
- Plan member joined
- Plan member withdrew
- schedule updated
- Activity finalized
- Activity reminder
- completion required
- Activity completed
- reflection requested
- guardian action required
- restriction notice
- trust history updated

---

## Disallowed Notification Patterns

- Come back
- You are missing out
- Daily streak
- Someone viewed your profile
- Your post is trending
- Random engagement prompt
- Artificial urgency
- Popularity comparison

Notifications should lead to meaningful action or necessary information.

---

# Search and Discovery

## Search Scope

Search may include:

- Intent
- Activity Type
- category
- location metadata
- public Experience
- profile when relevant to Intent context

Search must not include:

- Organization
- Organization profile
- Venue profile
- Place account
- popularity ranking

Location appears as filterable metadata, not as an owned content entity.

---

## Search Results

Results should show:

- Intent title
- Activity Type
- category
- date range
- location scope
- visibility-safe owner summary
- compatibility or relevance reason

Private Intent must never appear.

---

# Cards

## Card Types

- Intent Card
- Match Card
- Request Card
- Invitation Card
- Plan Card
- Activity Card
- Experience Card
- Profile Summary
- Notification Card
- Guardian Action Card
- Admin Review Card

No Organization Card or Venue Profile Card exists.

---

## Card Rules

Every card should have:

- clear object type
- title
- status
- essential metadata
- one primary action
- optional secondary actions
- loading state
- empty or unavailable fallback

Avoid nesting too many cards inside cards.

---

# Buttons

## Primary Button

Use for the main next action.

Examples:

- Create New Intent
- Publish Intent
- Send Request
- Accept
- Finalize Plan
- Complete Activity
- Save Reflection

---

## Secondary Button

Use for supporting actions.

Examples:

- Edit
- Manage Visibility
- View Profile
- Open Planning Room
- View History

---

## Destructive Button

Use red or clearly destructive styling.

Examples:

- Cancel Intent
- Cancel Activity
- Remove Participant
- Withdraw
- Reject
- Delete Draft

Destructive actions require confirmation when consequences are meaningful.

---

## Disabled Buttons

Disabled state must explain why when the reason is not obvious.

Examples:

- Capacity is full
- Guardian approval required
- Schedule is incomplete
- Activity has already ended
- Account restriction active

Do not use disabled buttons as silent dead ends.

---

# Forms

## Form Rules

Prefer:

- selection
- autocomplete
- date picker
- location search
- map selection with text alternative
- templates
- clear defaults
- progressive disclosure

Avoid:

- unnecessary free text
- raw database values
- manual coordinates
- hidden required fields
- overly long single-page forms

---

## Validation

Validation should:

- appear near the field
- explain the problem
- preserve user input
- avoid technical jargon
- work server-side and client-side
- focus the first invalid field where appropriate

Examples:

- End date cannot be before start date.
- Choose who can discover this Intent.
- Add a meeting point before finalizing the Plan.
- This Plan is already full.
- Guardian approval is required.

---

# Empty States

Empty states should explain:

- what is absent
- why it matters
- what the user can do next

Examples:

```text
No open Intent yet.
Create an Intent to begin matching.
```

```text
No forming Plans.
Accepted connections will appear here.
```

```text
No completed Activities.
Completed Activities become part of your Experience history.
```

Avoid meaningless copy such as:

```text
Nothing here.
```

---

# Loading States

Use:

- skeleton cards
- reserved layout space
- clear progress for multi-step operations
- optimistic updates only when rollback is safe

Avoid:

- endless generic spinners
- layout jumping
- blank screens
- fake progress percentages

---

# Error States

Error states should explain:

1. what failed

2. whether data was saved

3. what action is available

4. whether retry is safe

Examples:

- The Timeline could not be loaded. Your data was not changed.
- The request could not be accepted because the Plan is now full.
- The schedule changed before finalization. Review the latest version.
- You no longer have access to this Planning Room.

Never expose:

- SQL errors
- internal RPC names
- stack traces
- security policy details
- raw provider responses

---

# Success States

Success should be calm and clear.

Examples:

- Intent published
- Request sent
- Invitation accepted
- Plan created
- Schedule finalized
- Activity completed
- Reflection saved
- Profile updated

Avoid excessive animation, confetti or competitive celebration.

---

# Confirmation Dialogs

Use confirmation when actions are:

- destructive
- irreversible
- privacy-changing
- capacity-changing
- lifecycle-changing
- financially meaningful

Confirmation copy should state consequences.

Example:

```text
Finalize this Plan?

The schedule and meeting point will become the Planned Activity. New matching may close.
```

---

# Privacy Indicators

Visibility must be visible on:

- Intent Card
- Intent edit
- Match detail
- Plan detail
- Activity detail
- Experience
- public profile content

Possible labels:

- Public
- Friends
- Close Friends
- Selected People
- Everyone Except Selected People
- Invitation Only
- Private

Exact location visibility should be shown separately when necessary.

---

# Trust Indicators

Trust should be shown quietly.

Examples:

- Identity Verified
- Reliable Participant
- Reliable Host
- New to UIN
- Participation Restricted

Avoid:

- public precise score
- competitive ranking
- top-user labels
- popularity badges
- exaggerated safety claims

Trust must never visually dominate Intent compatibility.

---

# Accessibility

## Required Standards

- WCAG-aligned contrast
- keyboard navigation
- semantic HTML
- screen-reader labels
- focus management
- accessible dialogs
- large touch targets
- text resizing
- reduced motion
- descriptive image alternatives
- status not conveyed by color alone

---

## Maps

Maps require:

- textual location alternative
- keyboard-accessible controls
- non-map input path
- loading fallback
- privacy-aware precision
- descriptive external link

---

## Conversation

Conversation requires:

- readable message order
- sender labels
- timestamp access
- keyboard send
- error recovery
- new-message announcement where appropriate
- safe focus behavior

---

# Motion

Motion should communicate:

- state change
- expansion
- navigation
- confirmation
- loading
- error recovery

Motion must not:

- entertain for its own sake
- delay action
- create urgency
- simulate popularity
- distract from forms
- ignore reduced-motion preferences

---

# Responsive Behavior

## Mobile Navigation

May use:

- compact header
- bottom navigation
- overflow menu
- prominent Create Intent action

Avoid hiding Inbox or action-required states behind multiple menus.

---

## Desktop Navigation

May use:

- horizontal action row
- wider Timeline tabs
- two-column Planning Room
- side panels for members or schedule

The lifecycle and labels must remain identical across breakpoints.

---

# Administration UI

Admin interfaces may include:

- users
- Intent
- Plans
- requests
- moderation
- restrictions
- audit

Admin UI must:

- show reason and evidence
- preserve audit context
- require confirmation
- avoid exposing unnecessary personal data
- separate investigation from action
- label system state clearly

Admin UI does not create Organization accounts or direct Activities.

---

# Analytics UI

Internal product analytics may show:

- Intent publication
- Match conversion
- Request acceptance
- Plan formation
- Activity finalization
- Activity completion
- Experience creation
- safety outcomes
- error rates

Do not optimize or celebrate:

- screen time
- passive sessions
- profile views
- follower growth
- notification opens without action

---

# AI UI

AI appears as an assistant.

Possible actions:

- Suggest Intent type
- Clarify title
- Suggest Activity Type
- Interpret date range
- Explain visibility
- Detect duplicate Intent
- Suggest schedule options
- Summarize Planning Room
- Suggest reflection prompts

AI UI must show:

- suggestion status
- user review
- accept or reject
- editable output
- failure fallback

AI must not silently:

- publish Intent
- send Request
- send Invitation
- create Plan
- finalize Activity
- change visibility
- make guardian decisions
- change attendance
- apply reputation

---

# Content Style

UI copy should be:

- direct
- calm
- plain-language
- specific
- consistent

Avoid:

- marketing hype
- guilt
- artificial urgency
- vague success claims
- corporate account language
- engagement language

Prefer:

```text
No messages yet.
```

Over:

```text
Start the conversation and make magic happen!
```

The world has suffered enough exclamation marks.

---

# UI Testing

## Functional Tests

Test:

- Create Intent
- edit Intent
- visibility
- Match
- Request
- Invitation
- Plan formation
- Planning Room
- member actions
- schedule finalization
- Activity Room
- completion
- reflection
- managed profile
- restriction handling

---

## Visual Tests

Test:

- lifecycle status colors
- card consistency
- cover image fallback
- map fallback
- long names
- long Activity titles
- empty states
- error states
- dark mode when introduced
- mobile wrapping
- count badges

---

## Accessibility Tests

Test:

- keyboard-only flow
- screen readers
- focus order
- dialog focus trap
- color contrast
- reduced motion
- map alternative
- conversation announcements
- form error association
- touch target size

---

## Multi-Account Tests

Use at least two separate Person accounts to test:

- public Intent
- friends-only Intent
- Close Friends
- excluded users
- Request
- Invitation
- Match
- Plan membership
- participant visibility
- public profile
- blocking

Also test:

- guardian account
- managed child profile
- admin account
- restricted account

---

# UI Quality Gates

A UI feature is not complete until:

- lifecycle terminology is correct
- production build passes
- TypeScript passes
- mobile layout works
- loading state exists
- empty state exists
- error state exists
- permission state exists
- restricted state exists
- accessibility basics pass
- destructive actions are confirmed
- backend enforcement exists
- analytics do not leak private data
- documentation is updated

---

# Explicitly Excluded UI

The following interfaces are not part of UIN:

- Organization account switcher
- Organization profile
- Organization management
- Organization invitations
- Organization membership
- Organization Intent Builder
- Company dashboard
- NGO dashboard
- Community account
- Venue profile
- Venue owner dashboard
- Place account
- Place-owned Intent
- Venue-hosted Activity
- standalone Event creation
- direct Activity creation
- Event marketplace
- follower count
- public like count
- infinite content feed
- reels
- stories
- popularity leaderboard
- paid profile boost
- paid Match boost

These exclusions are permanent architectural constraints.

---

# UI Invariants

1. Every account shown in the product represents a Person.

2. Create action always creates Intent.

3. No direct Activity creation control exists.

4. No Organization or Venue account UI exists.

5. Location appears only as metadata or map context.

6. Match UI is Intent-first.

7. Planning Room represents a forming Plan.

8. Activity Room represents a finalized Plan.

9. Experience follows completed Activity.

10. Profile is an Intent biography.

11. Inbox contains decisions.

12. Notifications contain updates.

13. Visibility is explicit.

14. Exact location privacy is separate.

15. Participant identity is private by default.

16. Managed minor UI requires guardian controls.

17. Trust is contextual and quiet.

18. No popularity mechanics exist.

19. No infinite engagement feed exists.

20. One primary action dominates each screen.

21. Status is shown with text, not color alone.

22. Errors preserve user work where possible.

23. Loading, empty and restricted states are designed.

24. Mobile is the baseline.

25. Accessibility is mandatory.

---

# Final Principle

The best UIN interface is a bridge between Intent and real life.

It should help a Person understand what they intend, find compatible Intent, form a Plan, complete an Activity and reflect on the Experience.

The interface should then get out of the way.
