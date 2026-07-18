# UIN API Design

Version 1.0

## API Philosophy

UIN API is designed around Intent.

Every API endpoint must support one of the following actions:

- Create Intent
- Discover Intent
- Match Intent
- Fulfill Intent
- Reflect on Activity
- Build Intent Portfolio

No API should exist only for passive social interaction.

---

## Core Resources

### Profile

Represents the user identity and public Intent Biography.

### Intent

Represents a user's tactical, strategic or telos intention.

### Match

Represents compatibility between users or Intent.

### Activity

Represents a real-world execution of an Intent.

### Reflection

Represents post-activity feedback and memory.

### Portfolio

Represents the integrated Intent history of a person.

### Friendship

Represents trust, visibility and invitation relation.

---

## API Route Structure

```text
/api
├── profiles
├── intents
├── matches
├── activities
├── reflections
├── portfolio
├── friendships
├── notifications
└── admin