## 2026-08-07 — Join request lifecycle and custom Activity title moderation

- Join Requests now separates requests that need action from pending sent requests and request history.
- Accepted/planned/completed/cancelled/expired request records no longer remain in the active Received queue.
- Sent requests show host identity, profile navigation, request date and withdrawal controls.
- Custom Plan titles retain the canonical Activity name visibly as the original Activity identity.
- Reporting a custom Activity title immediately falls back to the canonical Activity name while preserving the reported text for moderation.
- Added title-under-review editing lock with no automatic reputation penalty or Activity lifecycle change.
- Added `/admin/moderation/titles` for restore/remove decisions.
- Timeline and Inbox join-request counters now ignore stale pending requests attached to non-active or expired Intents.
- Added migration `041_join_request_lifecycle_and_custom_title_moderation.sql`.


## 2026-08-07 — Seed Experience UI clarification

- Separated completed Seed Experience from Seed Journal in the detail UI.
- Added a dedicated Add/Edit Experience editor with visibility and linked media.
- Removed the ambiguous completed-Seed “Update reflection” sidebar action.
- Subject pages now distinguish “Add my experience” from “Open my experience”.
- No database migration required; existing reflection storage is reused.

# Changelog

All notable changes to the UIN product, architecture and philosophy are documented here.

This document follows the spirit of Keep a Changelog, but also records important product decisions.

---

# [0.2.0] - 2026-08-06

## Seed Catalogue and Search Integration

- Added a shared Seed subject catalogue above personal Seed instances.
- Normalized punctuation, Turkish characters, conjunctions and aliases so equivalent titles resolve to one subject.
- Added Seed Library search, subject detail pages, catalogue-based planting and personal Seed fallback.
- Added completion Experience engagement with Inspired, Save, comments and questions.
- Added admin review, approval, rejection and duplicate merge workflows.
- Added duplicate prevention for simultaneous suggestions and exact alias matching.
- Kept personal notes, visibility, links, progress and completion history separate for every user.
- Added retrospective completed Seeds for experiences that happened before the Seed was planted in UIN.
- Added exact-date, year-only and unknown completion timing without inventing fake dates in the interface.
- Added direct admin creation of active Seed Library subjects with aliases, translated titles and shared cover images.

---

# [0.1.0] - 2026-07-08

## 🎉 Project Foundation

The first complete product architecture was defined.

UIN was officially established as an Intent Network rather than a social network.

---

## Added

- Product Vision
- Core Principles
- Domain Model
- Database Design
- API Design
- System Architecture
- Match Engine
- Reputation System
- UI Philosophy
- Product Roadmap

---

## Product Decisions

### Intent First

Intent became the central domain object.

Every feature must support Intent.

---

### Three Intent Types

Intent is represented by three types:

- Tactical
- Strategic
- Telos

Different behavior.

Same core object.

---

### Intent Portfolio

Profiles are no longer social profiles.

Profiles became Intent Portfolios.

They represent:

- Past Intent
- Active Intent
- Planned Intent
- Integrated Experiences
- Life Themes

---

### Friendship

Friendship is a trust layer.

It is not the product.

It exists for:

- Visibility
- Invitations
- Safety
- Repeat Activities

---

### Privacy

Intent visibility is independent from profile visibility.

Every Intent owns its own visibility settings.

---

### Match Engine

The platform matches Intent.

Not people.

People become visible through shared Intent.

---

### Reputation

Reputation measures real-world reliability.

Not popularity.

No likes.

No followers.

No engagement metrics.

---

### Activity

Activity validates Intent.

Completed Activities become integrated into the user's Portfolio.

---

### Portfolio

Portfolio became a derived domain concept.

It represents a person's lived and planned Intent.

---

## Technical Decisions

- Next.js
- Supabase
- PostgreSQL
- Row Level Security
- Google Authentication
- Mobile-first architecture
- Domain-driven design
- Intent-centered architecture

---

## Product Boundaries

The following were explicitly rejected:

- Endless feeds
- Stories
- Reels
- Likes
- Follower economy
- Popularity metrics
- Engagement optimization

---

## Guiding Principle

Everything starts with Intent.