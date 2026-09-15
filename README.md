# NoBounds-Android

Android/Expo port of [NoBounds](../NoBounds) (Shaan's native iOS/Swift app), backed by [Supabase](https://supabase.com). Built with React Native + Expo Router.

This is a **rapid prototype**, not a 1:1 migration — see `AGENTS.md`/`CLAUDE.md` in this repo for the phase this is in and its conventions. `../NoBounds` is reference-only; nothing here writes to it.

**Backend note:** as of 2026-09-14 this connects directly to Shaan's real production Supabase project — the same one the live iOS app uses. It is not a sandbox. See `CLAUDE.md` for the ground rules Shaan set for backend changes (additive only, never touch what iOS depends on without checking `../NoBounds` first).

## Setup

1. `npm install`
2. Get the real project's URL and anon key from Shaan (or wherever the team keeps them) and put them in a new `.env.local`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://knbpxdhmmowfwydqhycg.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
3. `npx expo start` — then open in an Android emulator/device, iOS simulator, or web.

`supabase/schema.sql` is kept as a readable snapshot/reference of the backend shape, not something to paste into a SQL editor anymore — the real project already has its schema, and it's shared with iOS. Any backend change now means writing a real, reviewed migration against the live project (see `CLAUDE.md`), not re-running this file.

Env vars are inlined at bundle time, so restart the dev server after editing `.env.local` — a hot reload won't pick up the change.

## Architecture

| Layer | Location | Role |
|-------|----------|------|
| Theme | `src/constants/palettes.ts`, `src/contexts/palette-context.tsx` | 5 semantic palettes (ported hex-for-hex from iOS `ThemeTokens`), light/dark/system mode |
| UI primitives | `src/components/` | Themed building blocks (`NBCard`, `NBPrimaryButton`, `ScreenHeader`, `FormHeader`, …) |
| Supabase client | `src/lib/supabase.ts` | Single SDK client boundary, AsyncStorage-persisted session |
| Domain helpers | `src/lib/*.ts` | Per-feature data access (e.g. `habits.ts`) |
| Session | `src/contexts/session-context.tsx` | Auth session, profile, couple/pairing state |
| Navigation | `src/app/_layout.tsx`, `src/components/app-tabs.tsx` | Route gating (auth vs main), 5-tab shell |
| Screens | `src/app/` | Expo Router file-based routes |
| Backend | Shaan's real Supabase project | Shared with iOS — tables, RLS, functions (and possibly Edge Functions; `supabase/schema.sql` is a reference snapshot, not necessarily the full/current picture) |

**Palettes:** Classic Rose (default), Ocean Calm, Evergreen, Lavender Dusk, Paper Minimal — switchable in Settings → Appearance, synced to your account via `user_app_settings`.

**App shell:** Onboarding → auth → main tabs (solo or couple). Pairing is a modal, not a root gate — matches iOS's session-phase model.

## What's real vs. mock right now

Wired to the real Supabase project: Auth, Pairing (+ solo→couple merge on accept), Daily Prompts, Habits (+ solo→couple merge), Timeline memories, Profile, Appearance.

Still local mock data only, no backend table: Pet, Play (beyond Tic-Tac-Toe/flashcards), Date ideas, Gift ideas, Cycle tracking, Notifications, Weekly share, and the Bound/Photos presence feed (no real camera capture yet).

## Manual test plan (pairing + solo)

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Sign up, stay unpaired | Main tabs, solo Home banner ("Invite your partner") |
| 2 | Add a habit while solo | Saved with `couple_id = null`, visible on Home/Calendar |
| 3 | Generate an invite code (Pairing) | Code displayed; app stays usable while waiting |
| 4 | Second account accepts the code | Couple created; both land in couple mode |
| 5 | Both had pre-pair habits | Same `couple_id` after merge; nothing deleted |
| 6 | Answer today's prompt from both accounts | Reveals both answers once the second is submitted |
| 7 | Relaunch app while paired/unpaired | Session restores to the correct mode, no re-login needed |

To test pairing end-to-end you need two accounts — easiest is running one on an emulator and one on a physical device (or signing up a second email after signing out), both against the same Supabase project.

## Gitignore summary

Committed: source, `supabase/schema.sql`, docs.

**Not** committed: `.env.local` (your Supabase credentials), `node_modules/`, `AppPhotos/` and `Notes.md` (local reference screenshots/progress notes, not meant for the repo), generated native folders.
