# NoBounds-Android

Android/Expo port of [NoBounds](../NoBounds) (Shaan's native iOS/Swift app), backed by [Supabase](https://supabase.com). Built with React Native + Expo Router.

This is a **rapid prototype**, not a 1:1 migration — see `AGENTS.md`/`CLAUDE.md` in this repo for the phase this is in and its conventions. `../NoBounds` is reference-only; nothing here writes to it or to Shaan's production backend.

## Setup

1. `npm install`
2. Create your own Supabase project at [supabase.com](https://supabase.com) — **not** Shaan's production project.
3. Copy your project's URL and anon key into a new `.env.local`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Paste the full contents of [`supabase/schema.sql`](supabase/schema.sql) into your project's SQL Editor and run it. It's idempotent — safe to re-run any time you pull schema changes.
5. In your Supabase project, disable **Confirm email** under Authentication → Providers → Email, so sign-up logs you straight in (fine for a sandbox project).
6. `npx expo start` — then open in an Android emulator/device, iOS simulator, or web.

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
| Backend | `supabase/schema.sql` | Tables, RLS policies, RPC functions (no Edge Functions — plain SQL, since no Supabase CLI is required) |

**Palettes:** Classic Rose (default), Ocean Calm, Evergreen, Lavender Dusk, Paper Minimal — switchable in Settings → Appearance, synced to your account via `user_app_settings`.

**App shell:** Onboarding → auth → main tabs (solo or couple). Pairing is a modal, not a root gate — matches iOS's session-phase model.

## What's real vs. mock right now

Wired to your Supabase project: Auth, Pairing (+ solo→couple merge on accept), Daily Prompts, Habits (+ solo→couple merge), Timeline memories, Profile, Appearance.

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
