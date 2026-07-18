# UIN Reputation System

Version 2.0

---

# Purpose

The Reputation System helps UIN answer a narrow operational question:

```text
How much verified trust evidence exists that this Person will participate safely and reliably?
```

Reputation is not a measure of human worth.

It is not popularity.

It is not influence.

It is not a personality score.

It is a bounded, contextual and recoverable projection derived from verified behavior across the UIN lifecycle:

```text
Person → Intent → Match / Request / Invitation → Plan → Activity → Experience
```

---

# Core Product Rules

1. Reputation belongs only to a Person.

2. Reputation is earned from auditable behavior.

3. No account may purchase reputation.

4. No follower, like, profile-view or content-engagement metric contributes to reputation.

5. Reputation must never replace Intent compatibility.

6. Reputation must never bypass privacy, blocking, guardian, capacity or safety rules.

7. Reputation is contextual, not a single permanent label.

8. Negative outcomes require evidence and proportionality.

9. Recovery must always be possible unless a safety restriction requires permanent removal.

10. Raw reports do not automatically become negative reputation.

11. A disputed event must not be treated as final until the dispute workflow is resolved.

12. Reputation calculations must be versioned and auditable.

13. Public trust summaries must not expose private safety or moderation data.

14. Managed minor reputation requires stricter privacy and guardian controls.

15. The system must avoid creating social rank, public leaderboards or competitive status.

---

# What Reputation Measures

Reputation may measure verified patterns such as:

- attendance reliability
- punctuality
- host reliability
- planning quality
- communication reliability
- respectful participation
- safe conduct
- contribution to shared Plans
- cancellation behavior
- completion consistency
- dispute resolution
- identity verification
- repeated successful Activities
- category-specific experience

Reputation does not measure:

- attractiveness
- wealth
- social status
- political views
- personality
- creativity as a human trait
- intelligence
- moral worth
- popularity
- follower count
- public visibility
- profile completeness alone

---

# Reputation Sources

Reputation is created only from verified or controlled events.

Valid sources may include:

- completed Activity
- attendance record
- no-show record
- late cancellation
- verified early cancellation
- successful Plan completion
- host schedule finalization
- participant withdrawal
- confirmed safety violation
- resolved report
- verified identity
- repeated reliable participation
- approved dispute correction
- guardian-approved managed minor participation
- system-detected abuse confirmed by review

Invalid standalone sources include:

- unverified complaint
- one-sided reflection
- profile view
- public reaction
- message volume
- time spent in the application
- number of Intent records created
- number of Matches received
- number of invitations sent
- public profile traffic
- social popularity

---

# Reputation Architecture

The target reputation architecture separates source events from projections.

```text
Verified Domain Event
        ↓
Reputation Event
        ↓
Contextual Reputation Projection
        ↓
Visibility-Safe Trust Summary
```

The source of truth is the append-only event history.

Trust scores, labels and badges are rebuildable projections.

A projection may be recalculated when:

- algorithm version changes
- an event is corrected
- a dispute is resolved
- a safety decision changes
- decay rules are updated
- a source record is deleted or invalidated

---

# Reputation Events

A reputation event is an append-only record derived from a verified source.

Recommended fields:

- id
- user_id
- source_intent_id
- source_plan_id
- source_attendance_record_id
- source_report_id
- source_moderation_action_id
- event_type
- category_id
- value
- confidence
- severity
- status
- metadata
- algorithm_version
- created_at
- effective_at
- expires_at
- reversed_by_event_id

Possible statuses:

- active
- disputed
- suspended
- reversed
- expired

Rules:

- Users may not insert reputation events directly.
- Every event must have an auditable source.
- Historical events are not edited in place.
- Corrections use compensating or reversal events.
- Metadata must not contain unnecessary private information.
- Public APIs must never return raw moderation metadata.

---

# Positive Reputation Events

Examples:

- activity_completed
- attended
- arrived_on_time
- reliable_host
- planning_completed
- helpful_participant
- repeat_participant
- respectful_communication
- verified_identity
- dispute_resolved_cooperatively
- guardian_supervision_completed
- accessibility_support_provided
- safe_activity_completion

Positive events should require real evidence.

Examples of evidence:

- completed Plan status
- attendance record
- host completion confirmation
- participant confirmation where policy allows
- system timestamp
- resolved moderation record
- verified identity provider result

A positive reflection alone should not create a major reputation increase.

---

# Negative Reputation Events

Examples:

- no_show
- late_cancellation
- repeated_withdrawal
- host_abandoned_plan
- misleading_schedule
- confirmed_spam
- confirmed_harassment
- confirmed_unsafe_behavior
- identity_fraud
- capacity_abuse
- guardian_policy_violation
- repeated_message_abuse
- safety_restriction_applied

Negative events require stronger evidence than positive routine events.

Rules:

- A raw report is not a confirmed event.
- A single disputed allegation must not reduce public trust.
- Severe confirmed safety violations may bypass normal decay.
- Minor operational failures should have limited weight.
- The same incident must not be counted multiple times under different event names.
- Automated detection may create a review signal, not a final negative reputation event.

---

# Contextual Reputation Dimensions

A Person may have multiple independent reputation dimensions.

## Attendance Reliability

Measures whether the Person attends confirmed Activities.

Possible inputs:

- attended
- no-show
- cancellation timing
- repeated pattern
- unresolved attendance dispute

---

## Punctuality

Measures timeliness when reliable timing evidence exists.

Possible inputs:

- verified check-in
- host-confirmed arrival
- participant-confirmed arrival
- system-based arrival evidence

Punctuality must not be inferred from unreliable or invasive location tracking.

---

## Host Reliability

Measures behavior when acting as Primary Host or Co-host.

Possible inputs:

- finalized schedule
- clear meeting point
- reasonable notice
- completion handling
- low abandonment rate
- attendance review quality
- participant safety outcomes

Host Reliability must not become a public prestige rank.

---

## Planning Quality

Measures operational quality during the forming Plan stage.

Possible inputs:

- timely schedule updates
- clear communication
- realistic capacity
- stable meeting point
- budget transparency
- proper cancellation handling

This dimension replaces vague or ambiguous labels that could be confused with institutional account types.

---

## Communication Reliability

Measures whether communication supports Plan execution.

Possible inputs:

- timely response to critical Plan changes
- respectful language
- absence of confirmed spam
- clear cancellation notice
- successful conflict resolution

Message volume is not a positive signal.

Silence is not automatically a negative signal unless a required operational action was ignored.

---

## Safety

Measures verified safety outcomes.

Possible inputs:

- confirmed safety violation
- completed Activities without safety incidents
- moderation resolution
- active restriction
- verified identity
- guardian compliance

Safety information is highly sensitive.

Public output should be limited to coarse indicators such as:

- no active safety restriction
- identity verified
- participation currently restricted

The system must not publish allegation details.

---

## Collaboration

Measures behavior inside shared Plans.

Possible inputs:

- respectful participation
- budget commitment reliability
- support for accessibility needs
- constructive coordination
- repeated successful participation

---

## Category Experience

Represents verified participation history by Activity category.

Examples:

- walking
- theatre
- volunteering
- language practice
- hiking
- basketball

Category Experience is not expertise certification.

It may show:

- completed Activities
- attendance reliability
- hosting history
- recent participation

It must not claim professional qualification unless separately verified.

---

# Category-Specific Reputation

Reputation is contextual.

A Person may be:

- highly reliable in walking Activities
- new to volunteering
- experienced as a study participant
- reliable as a host for small groups
- inconsistent in a specific recurring Activity context

Category-specific projections may use:

- completed Activity count
- attendance rate
- cancellation pattern
- recency
- host role
- participant role
- safety outcomes

Rules:

- Small sample sizes must be labeled.
- Category scores must not imply overall human trustworthiness.
- Sparse categories should display descriptive evidence rather than a precise score.
- Old evidence may decay.
- Severe safety findings may apply across categories when policy requires.

---

# Trust Projection

Trust is a derived projection.

It may include:

- overall operational reliability
- host reliability
- participant reliability
- identity status
- category-specific evidence
- active safety restriction status
- confidence level
- sample size
- recency

A trust projection must include:

- algorithm version
- calculated_at
- evidence window
- confidence
- source event count

The system should avoid presenting false precision.

Prefer:

```text
Reliable participant
Based on 12 completed Activities
```

Over:

```text
Trust Score: 87.43
```

A numeric score may exist internally, but public presentation should use bounded, understandable language.

---

# Trust Levels

Possible descriptive levels:

- New
- Developing History
- Reliable
- Highly Reliable
- Restricted

Rules:

- New is not a negative label.
- Levels are not competitive.
- No public leaderboard exists.
- Restricted reflects active product policy, not moral judgment.
- Level thresholds must be versioned.
- Public level may be hidden by privacy policy.

---

# Confidence

Every projection should include confidence.

Possible confidence levels:

- low
- medium
- high

Confidence may depend on:

- number of verified events
- recency
- consistency
- source quality
- dispute status
- category coverage

A high score with low confidence must not outrank a moderate score with strong evidence without careful policy.

---

# Cold Start

New users have little or no reputation history.

The system must not bury them.

Cold-start behavior should rely on:

- structured Intent compatibility
- verified profile basics
- explicit availability
- location compatibility
- visibility
- account status
- optional identity verification

New users may be shown as:

```text
New to UIN
No completed Activity history yet
```

They must not be labeled untrusted merely because they are new.

---

# Reputation and Match Engine

Reputation is a secondary Match factor.

Priority order:

1. hard eligibility

2. privacy

3. blocking

4. guardian policy

5. account restrictions

6. Intent compatibility

7. availability

8. location

9. capacity

10. bounded trust adjustment

Reputation must never:

- create a Match without Intent
- override a block
- override private visibility
- override capacity
- override managed minor policy
- replace Activity compatibility
- permanently exclude new users

A trust adjustment should be capped.

Example:

```text
final_match_score =
  compatibility_score
  + bounded_trust_adjustment
```

The adjustment must remain small enough that incompatible Intent never outranks compatible Intent.

---

# Reputation and Plan Admission

Plan admission may consider:

- active restrictions
- capacity
- source Intent
- invitation or request status
- current Plan state
- relevant reliability evidence
- managed minor policy
- safety requirements

Low or absent reputation must not automatically reject participation.

Higher-risk Activities may require explicit policy such as:

- verified identity
- guardian approval
- host review
- manual moderation approval

These requirements must be transparent and category-specific.

---

# Reputation and Hosting

Hosting privileges may depend on:

- account status
- verified identity where required
- absence of active safety restrictions
- prior Activity history
- host reliability
- group-size policy
- category-specific safety requirements

Possible staged privileges:

- host small Plans
- host recurring Plans
- host larger groups
- invite managed profiles where policy allows
- use advanced planning tools

Rules:

- Privileges must be transparent.
- Privilege limits must not be sold.
- Restrictions must be appealable.
- New users should still be able to host low-risk small Plans when policy allows.

---

# Reputation and Portfolio

Portfolio may display safe, user-authorized reputation evidence.

Examples:

- completed Activities
- categories experienced
- reliable participant label
- host history
- identity verification
- public badges
- public Experiences

Portfolio must not display:

- raw reports
- private moderation notes
- exact no-show history
- private disputes
- hidden restrictions
- participant complaints
- internal risk score
- follower or engagement metrics

---

# Reflection Contribution

Reflections contribute cautiously.

A reflection may provide:

- qualitative feedback
- would-repeat signal
- private learning signal
- pattern evidence

A reflection must not immediately create a large reputation change.

The system should evaluate:

- consistency across independent sources
- relationship between reviewers
- repeated coordinated behavior
- outliers
- dispute history
- retaliation risk
- sample size
- confidence

No single reflection should permanently damage a Person.

Positive reflections must not become a purchasable rating economy.

---

# Reports and Moderation

Reports and reputation are separate systems.

```text
Report
  ↓
Review
  ↓
Moderation Decision
  ↓
Optional Reputation Event
```

Rules:

- Filing a report does not change reputation.
- Dismissed reports do not create negative reputation.
- Confirmed incidents may create one or more bounded events.
- Severe restrictions may affect access immediately.
- Reputation updates should follow the final moderation decision.
- Appeals may reverse or compensate events.

---

# Disputes

A Person may dispute eligible reputation events.

Possible dispute flow:

```text
Event Created
  ↓
Dispute Submitted
  ↓
Event Marked Disputed
  ↓
Evidence Review
  ↓
Upheld / Reversed / Adjusted
```

Rules:

- Disputed events may be excluded or down-weighted until resolution.
- Severe safety restrictions may remain active during review when necessary.
- Resolution must be audited.
- Users must receive a plain-language outcome.
- Internal moderation evidence may remain confidential.

---

# Reputation Decay

Minor operational mistakes should fade.

Examples:

- one no-show
- one late cancellation
- one missed response
- an old low-severity planning failure

Decay may depend on:

- severity
- recurrence
- time since event
- subsequent positive behavior
- category
- whether the event was disputed

Possible model:

```text
effective_weight =
  original_weight × decay_factor(age, severity)
```

Rules:

- Severe confirmed safety violations may decay slowly or not at all.
- Identity fraud may remain relevant while unresolved.
- Positive routine events may also decay so old history does not dominate forever.
- Decay rules must be versioned.
- Decay must not rewrite source history.

---

# Recovery

Recovery is a required product property.

Recovery may occur through:

- consistent attendance
- successful Activity completion
- reliable hosting
- timely cancellation
- respectful communication
- verified identity
- completed safety education
- restriction period completion
- successful appeal
- long-term stable behavior

The system should show actionable recovery guidance where appropriate.

Examples:

- Complete several Activities with reliable attendance.
- Avoid late cancellation during the recovery period.
- Verify your identity.
- Resolve the active restriction.
- Complete the required safety review.

Recovery guidance must not be manipulative or humiliating.

---

# Reputation Badges

Badges may recognize verified contribution.

Examples:

- Reliable Participant
- Reliable Host
- Consistent Attendance
- First Completed Activity
- Ten Completed Activities
- Volunteer Contributor
- Accessibility Supporter
- Identity Verified
- Repeat Participant
- Safe Planning Record

Badges must:

- be evidence-based
- have clear criteria
- avoid competitive ranking
- avoid public scarcity
- avoid paid access
- be revocable when evidence changes
- respect visibility settings

Avoid badges such as:

- Most Popular
- Top Profile
- Most Viewed
- Influencer
- Number One Host
- Community Celebrity

---

# Milestones

Milestones may summarize verified history.

Examples:

- first completed Activity
- five completed Activities
- first hosted Activity
- five reliable attendances
- first recurring Plan completed
- one year without a no-show
- completed Activities in three categories

Milestones should support reflection and portfolio, not competition.

---

# Reputation Visibility

Possible visibility:

- private
- participants_only
- friends_only
- public

Visibility may vary by dimension.

Examples:

- identity verification may be public
- raw attendance history remains private
- category experience may be public
- restriction details remain private
- coarse safety eligibility may be visible where necessary

Rules:

- Profile visibility does not automatically expose reputation details.
- Public trust summaries must be minimal.
- Exact scores should normally remain private.
- Safety-critical eligibility may override user preference only where policy requires.
- Managed minor reputation is private by default.

---

# Managed Minor Reputation

Managed minor reputation requires special handling.

Rules:

- Public numerical scores are prohibited.
- Guardian identity and decisions remain private.
- Attendance history is visible only to authorized guardians and staff.
- Minor mistakes must not create long-term public labels.
- Safety events require careful review.
- Participation restrictions must be explained to guardians.
- Reputation data must not expose age or exact location.
- Guardian actions must not be attributed to the child unless the child was the responsible actor.
- Adult host feedback about a child must not become direct reputation without controlled review.

Possible public output:

```text
Managed profile
Participation requires guardian approval
```

Not:

```text
Low trust minor
```

---

# Anti-Gaming Rules

The system must detect reputation manipulation.

Examples:

- fake Activities
- repeated self-created Plans with no real execution
- coordinated reciprocal praise
- mass invitations for reputation farming
- repeated low-value Activity completion
- duplicate accounts
- collusive attendance confirmation
- manipulated check-in data
- retaliation reports
- badge farming
- automated message behavior

Detection signals create review cases.

They do not automatically create permanent reputation penalties.

Confirmed manipulation may:

- invalidate source events
- reverse badges
- restrict hosting
- limit requests or invitations
- trigger moderation review
- suspend the account

---

# Reputation Calculation

A production calculation should separate dimensions.

Example internal model:

```text
participant_reliability =
  weighted_attendance
  + timely_cancellation
  + respectful_participation
  - no_show_penalty
  - late_cancellation_penalty

host_reliability =
  completed_hosted_activities
  + schedule_quality
  + communication_quality
  + attendance_review_quality
  - abandoned_plan_penalty
  - confirmed_host_failure_penalty

safety_eligibility =
  verified_identity_adjustment
  - active_restriction_penalty
  - confirmed_safety_event_penalty
```

The overall projection may be:

```text
overall_trust =
  weighted_contextual_dimensions
  × confidence_factor
```

Rules:

- Exact weights are internal and versioned.
- Confidence limits the effect of sparse evidence.
- Severe active restrictions are handled as policy gates, not merely score penalties.
- Scores must be clamped to documented ranges.
- Every projection must be reproducible from active events.

---

# Example Weighting Principles

Routine positive events:

- small incremental value
- diminishing returns
- category-aware
- recency-aware

Minor negative events:

- moderate value
- recoverable
- pattern-sensitive

Severe confirmed safety events:

- high impact
- policy-gated
- reviewable
- appealable

Repeated behavior:

- pattern multiplier
- bounded maximum
- time-window controlled

Identity verification:

- trust-supporting signal
- not proof of good behavior
- never a substitute for Activity history

---

# Fairness

The Reputation System must be tested for unfair outcomes.

Review areas include:

- new-user disadvantage
- location disadvantage
- economic bias
- disability-related attendance complexity
- caregiving responsibilities
- transportation disruption
- language differences
- managed minor treatment
- category imbalance
- false report patterns
- model bias
- over-penalization of rare mistakes
- under-reporting of harmful behavior

Context may matter.

Examples:

- verified emergency cancellation
- accessibility failure caused by the host
- public transport disruption
- guardian cancellation
- weather-related Activity cancellation

Context must not become a loophole for repeated abuse.

---

# Transparency

Users should understand:

- what reputation means
- which broad behaviors affect it
- whether a restriction is active
- how to recover
- how to dispute an event
- which parts are visible
- whether the algorithm recently changed

Users do not need access to:

- fraud detection thresholds
- private report details
- other users' confidential statements
- exact anti-abuse rules
- raw internal risk score

---

# Notifications

Allowed reputation-related notifications:

- Trust history updated
- New verified milestone
- Badge earned
- Badge reversed
- Attendance record added
- Reputation event disputed
- Dispute resolved
- Restriction applied
- Restriction lifted
- Recovery milestone reached
- Identity verification completed

Notifications must not:

- shame the user
- create public pressure
- encourage compulsive behavior
- compare the user to others
- use artificial urgency
- reveal confidential moderation details

---

# AI Responsibilities

AI may:

- detect anomaly patterns
- identify possible collusion
- group similar behavioral signals
- summarize evidence for reviewers
- detect inconsistent report patterns
- suggest recovery actions
- assist category classification
- identify projection drift
- generate plain-language explanations

AI must not:

- issue permanent punishment
- confirm a safety violation alone
- infer protected attributes
- expose private reports
- produce personality judgments
- rank human worth
- create public labels without policy
- silently change reputation weights
- bypass appeal rights

Final authority belongs to controlled policy and authorized review.

---

# Operational Monitoring

The system should monitor:

- event creation volume
- reversal rate
- dispute rate
- upheld dispute rate
- false-positive rate
- score distribution
- cold-start outcomes
- category coverage
- restriction rate
- recovery rate
- badge issuance
- abuse detection precision
- algorithm-version migration effects
- public visibility exposure
- managed minor event count

Monitoring must not expose raw private data.

---

# Data Retention

Reputation event retention should follow:

- legal requirements
- safety requirements
- dispute windows
- account deletion policy
- portfolio integrity
- audit policy

Rules:

- Public projections may be removed before internal audit history.
- Reversed events remain for audit but have no active weight.
- Expired events remain historically visible only to authorized systems.
- Deleted users must not remain discoverable through reputation projections.
- AI embeddings or analytics derived from deleted reputation data must be invalidated.

---

# Testing Strategy

## Unit Tests

Test:

- event weighting
- decay
- confidence
- reversal
- dispute suspension
- category projection
- level thresholds
- visibility filtering
- cold-start behavior

## Integration Tests

Test:

- Activity completion creates valid events
- no-show creates one bounded event
- raw report creates no reputation change
- moderation resolution creates the correct event
- reversal recalculates projections
- active restriction affects eligibility
- Match adjustment remains bounded
- managed minor privacy is enforced
- deleted data leaves no public projection

## Property Tests

Verify:

- no follower metric affects reputation
- no raw report affects reputation
- no direct user write creates reputation
- no incompatible Intent becomes compatible because of reputation
- no blocked Person becomes visible because of reputation
- no managed minor receives a public numerical score
- no reversed event contributes active weight
- projections are reproducible from source events

## Load Tests

Test:

- projection rebuild
- high-volume event ingestion
- concurrent Activity completion
- dispute recalculation
- badge projection
- category projection
- notification generation

---

# Reputation API Responsibilities

Read operations may include:

- get private trust summary
- get public trust summary
- get category history
- get milestones
- get badges
- get recovery guidance
- get dispute eligibility

Write operations must be controlled:

- create event from verified domain action
- dispute event
- resolve dispute
- reverse event
- apply restriction
- lift restriction
- rebuild projection
- issue or revoke badge

Users must not call unrestricted reputation-event insertion endpoints.

---

# Migration Guidance

When removing legacy reputation concepts:

1. inventory all reputation labels, event types and projections

2. remove any account-type-specific reputation model

3. replace ambiguous institutional wording with Person roles such as Host, Co-host or Participant

4. map old planning-quality signals to Host Reliability or Planning Quality

5. remove direct Event or standalone Activity assumptions

6. ensure source records reference Intent, Plan, Activity outcome or moderation evidence

7. preserve valid historical Person behavior

8. invalidate unsupported badges

9. rebuild projections

10. regenerate database types

11. test Match adjustment bounds

12. verify public privacy output

Legacy account-type reputation must not remain active as a dormant feature.

---

# Reputation Invariants

1. Reputation belongs to a Person.

2. Reputation measures verified behavior.

3. Reputation does not measure human worth.

4. Popularity never contributes.

5. Followers never contribute.

6. Profile views never contribute.

7. Time spent never contributes.

8. Raw reports never contribute.

9. Reputation never overrides Intent.

10. Reputation never overrides privacy.

11. Reputation never overrides blocking.

12. Reputation never overrides guardian policy.

13. Reputation never overrides capacity.

14. Reputation is contextual.

15. Reputation is recoverable.

16. Negative events require evidence.

17. Disputes are reviewable.

18. Corrections use append-only reversal events.

19. Public summaries hide sensitive evidence.

20. Managed minor reputation is private by default.

21. New users are not treated as untrusted.

22. Trust adjustments are bounded.

23. Severe restrictions are policy gates.

24. Projections are versioned.

25. Projections are rebuildable.

26. Badges are evidence-based.

27. No leaderboard exists.

28. No reputation may be purchased.

29. AI assists but does not permanently judge.

30. The system exists to improve safe real-world participation.

---

# Explicitly Excluded Models

The Reputation System does not support:

- institutional account reputation
- company reputation
- club reputation
- venue reputation
- place reputation
- public popularity score
- follower-based trust
- purchasable trust
- paid verification that implies behavior quality
- profile-view score
- content engagement score
- public human ranking
- global leaderboard
- permanent punishment for minor mistakes
- direct reputation changes from unverified reflections
- automated permanent safety decisions
- direct Activity creation as a reputation source
- reputation events without auditable evidence

These exclusions are architectural constraints.

---

# Final Principle

Reputation exists to make Intent-driven real-world participation safer and more reliable.

It must help people make informed decisions without turning human behavior into a popularity contest.

Reputation supports trust.

It does not rank human value.
