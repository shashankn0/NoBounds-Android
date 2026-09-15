@AGENTS.md

## Project Context

### What this is
NoBounds-Android is an Android port of NoBounds, an existing iOS app
(native Swift) for people in long-distance friendships/relationships —
staying connected through shared photos, conversation prompts, and
rituals. The original iOS codebase is ~200,000 lines of Swift.

### People
- Shaan: owns/founded the project and the original NoBounds iOS repo.
  He's the one who invited me to the private repo and scoped this
  Android port.
- Me: building the Android version. Unpaid/informal collaboration,
  not a job — I'm doing this as a side project, not employed by Shaan
  or any company.

### The reference codebase
- Located as a sibling folder at ../NoBounds — this is Shaan's actual
  iOS Swift app, forked into my GitHub for read access only.
- DO NOT edit anything in ../NoBounds. It's reference-only, to understand
  screens, navigation, and how features work — not code to copy directly
  (Swift doesn't translate 1:1 to React Native anyway).

### Current phase: rapid prototype (Shaan's explicit instructions)
Shaan's guidance: don't try to carefully and correctly migrate all
200,000+ lines on the first attempt — that's unrealistic. Instead, build
a rough, fast prototype in 2-5 days using AI coding tools, without much
restraint. Some features will work, some won't — the goal of this phase
is to learn what AI-assisted conversion handles well vs. poorly, then use
that to scope the real migration plan afterward.

This means: prioritize speed and breadth over polish right now. It's
okay to leave things broken or incomplete during this phase.

### Tech decisions made
- Frontend: React Native + Expo (my choice — I already have some
  experience with Expo from a separate personal project, faster than
  learning native Kotlin from scratch for this prototype phase)
- Backend: Supabase — as of 2026-09-14, connected directly to Shaan's
  real production project ("No Bounds", ref knbpxdhmmowfwydqhycg). This
  is NOT a sandbox anymore — it's the same backend the live iOS app
  uses, with real couples' data on it. The earlier standalone sandbox
  project is retired.
  - Shaan has explicitly given permission to make backend changes
    (schema, RLS, functions) as needed for the Android port, with one
    hard constraint: **never break the iOS app.** In practice:
    - Prefer additive changes: new tables, new nullable columns, new
      functions. Don't drop, rename, or retype anything existing.
    - Before changing any table/column/function/RLS policy that
      already exists, check ../NoBounds (the real iOS source) to see
      whether iOS depends on its current shape — the iOS Swift code is
      the ground truth for what's safe to touch, not assumptions.
    - Never delete or mutate existing rows — this is real user data,
      not throwaway sandbox rows.
    - When genuinely unsure whether a change is iOS-safe, ask rather
      than guess; a wrong guess here affects Shaan's live app, not
      just this one.

### Known things NoBounds (iOS) likely handles that need Android equivalents
- Auth: Sign in with Apple / Keychain → will need Google Sign-In /
  Android Keystore equivalent eventually
- Push notifications: APNs → Firebase Cloud Messaging (FCM) eventually
- Permissions (camera, photos, contacts for pairing/invite flow):
  Android's runtime permission model differs from iOS's

### Conventions
- Components in src/components/, screens in src/app/
- Functional components with hooks, not class components
- When building a feature, check ../NoBounds first for the Swift
  equivalent, explain what it does, then propose the RN version