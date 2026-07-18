# Changelog

All notable changes to the UIN product, architecture and philosophy are documented here.

This document follows the spirit of Keep a Changelog, but also records important product decisions.

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