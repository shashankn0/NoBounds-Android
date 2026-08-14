# NoBounds-Android — Status Notes

Rough Android prototype of [NoBounds](../NoBounds) (Shaan's iOS/Swift app), built with React Native + Expo. This is the rapid-prototype phase — speed/breadth over correctness, per AGENTS.md/CLAUDE.md.

## Stack

- **Frontend:** Expo SDK ~57, Expo Router (file-based routing), React 19.2.3, React Native 0.86.2
- **Backend:** Supabase (own sandbox project — not Shaan's production one)
- **Language:** TypeScript, functional components + hooks only
- **Navigation:** `expo-router` with route groups — `(auth)` and `(tabs)`, gated via `Stack.Protected` on auth session state

## Project structure

```
src/
  app/
    _layout.tsx            root layout — session/palette providers, auth gating, nav theme
    (auth)/                 welcome carousel, sign-in, sign-up (unauthenticated)
    (tabs)/                 the 5 main tabs: index(Home), prompt, photos, play, timeline
    pairing.tsx             pairing modal (create/accept invite)
    profile.tsx             profile sheet (avatar, name, time zone, nav rows)
    settings/               settings hub + appearance (palette/theme picker)
    notifications.tsx, pet.tsx, date-ideas.tsx, gifts.tsx,
    calendar.tsx, cycle-tracking.tsx, weekly-share.tsx    secondary stack screens
  components/
    app-tabs.tsx            custom floating tab bar (5 tabs, always-visible labels)
    nb-card.tsx, nb-button.tsx, nb-list-row.tsx, screen-header.tsx   shared UI primitives
    month-calendar.tsx      mini month grid used in Timeline
    themed-text.tsx, themed-view.tsx   palette-aware text/view primitives
  constants/
    palettes.ts             5 palettes, exact hex values ported from iOS ThemeTokens
    theme.ts                spacing/fonts/legacy Colors (mostly superseded by palettes.ts)
  contexts/
    session-context.tsx     Supabase auth session + profile + couple state
    palette-context.tsx     active palette id + light/dark/system mode
  lib/
    supabase.ts              Supabase client (AsyncStorage-persisted session)
    mock/                    local mock data for every not-yet-wired feature
supabase/
  schema.sql                 full SQL schema — paste into Supabase SQL Editor
```

## What's implemented

### Wired to real backend (Supabase)
- **Auth** — email/password sign-up/sign-in via Supabase Auth
- **Pairing** — create/accept invite codes via SQL RPCs (`create_couple_invite`, `accept_couple_invite`), atomic couple creation
- **Daily prompts** — one prompt/day per couple, answers stored in `prompt_answers`, reveal-when-both-answered logic
- **Timeline memories** — text + optional photo (uploaded to Supabase Storage), listed per couple

### Visual/structural only (mock data, iOS-matched UI)
- **Home** — solo invite banner, habits card, extensions card (exact copy/layout matched to iOS screenshots); paired state shows summary cards for prompt/presence/pet/weekly-share/date-ideas/gifts
- **Bound (Photos)** — solo empty state matches iOS copy exactly; paired state shows a simple mock photo history list (no real camera/upload — iOS's camera-first capture flow was intentionally skipped this pass)
- **Play** — real local Tic-Tac-Toe and Spanish/Japanese flashcard decks; Draw & Guess is a placeholder (needs realtime, out of scope); games grid matches iOS exactly (titles/subtitles/icons)
- **Pet, Date ideas, Gifts, Cycle tracking, Calendar/Habits, Notifications, Weekly share** — all local mock data, no backend
- **Profile / Settings / Appearance** — structurally matched to iOS (avatar, display name, time zone, nav rows; Settings cards for partner connection/account/legal/data/about + sign out; Appearance with 3-swatch palette cards + System/Light/Dark toggle)

### Design system
- 5 palettes ported **exactly** (hex-for-hex) from `../NoBounds/NoBounds/Core/Theme/Palettes/*Tokens.swift`: Classic Rose (default), Ocean Calm, Evergreen, Lavender Dusk, Paper Minimal — each with light + dark variants
- Shared primitives mirror iOS's `NBCard`/`NBPrimaryButton`/`NBSecondaryButton` (16pt radius cards, pill-ish buttons, consistent spacing)
- Custom floating tab bar (5 tabs, always-visible labels, pill highlight on selected) — matches iOS's tab bar look
- Custom `ScreenHeader` (bell + avatar) on every tab screen, mirroring iOS's per-tab nav bar toolbar

## What's NOT done yet (known gaps)

- **No real camera/photo capture** — Bound tab is a static mock list, not the actual camera-first flow iOS has
- **No real-time features** — Draw & Guess game, live partner presence, push notifications are all unimplemented
- **No Google Sign-In / Android Keystore** — only email/password auth right now
- **No FCM push notifications** — Notifications screen is fully mock data
- **No Android runtime permission flows** (camera/photos/contacts)
- **Pet, Date ideas, Gifts, Cycle tracking, Habits/Calendar, Weekly share** have no backend — everything resets on reload, nothing persists or syncs between partners
- **Profile "Save name" doesn't persist** — no update call wired to Supabase yet
- **No account deletion / data export** — Settings rows are placeholders (no-ops)
- **Widget tab** — dropped entirely (iOS home-screen widget doesn't map to Android in this phase)
- **Debug/Supabase-health screen** — skipped (not built)
- Email confirmation is Supabase's default — needs to be disabled in the Supabase dashboard (Authentication → Providers → Email) for sign-up to work without a confirmation click, since this is just a sandbox project

## Backend setup required (one-time, per developer)

1. Create a free Supabase project (your own — not Shaan's)
2. Fill `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` into `.env.local` (gitignored)
3. Paste `supabase/schema.sql` into the project's SQL Editor and run it
4. Disable "Confirm email" under Authentication → Providers → Email
5. Restart `npm run android`/`npm run web` after any `.env.local` change (env vars are inlined at bundle time, not hot-reloaded)

## Schema (Supabase, trimmed subset of iOS phase-1 schema)

`profiles`, `couples`, `couple_members`, `couple_invites`, `prompt_templates` (seeded, ~10 static prompts), `couple_daily_prompts`, `prompt_answers`, `memories` — all RLS-enabled, gated by an `is_couple_member()` helper matching the iOS RLS pattern. Storage bucket `memories` for timeline photos.

## Suggested next steps (not yet decided/prioritized)

- Wire Pet/Date ideas/Gifts/Habits/Cycle tracking to real Supabase tables (schema exists in iOS's `docs/08-supabase-schema-phase1.md` and migration history for reference)
- Real camera capture for Bound (expo-camera or expo-image-picker camera mode)
- Persist Profile display-name edits
- Push notifications via FCM
- Google Sign-In for parity with iOS's Sign in with Apple
