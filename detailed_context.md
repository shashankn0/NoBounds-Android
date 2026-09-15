# NoBounds-Android — Detailed Context

This file is the narrative counterpart to `CLAUDE.md`. `CLAUDE.md` stays short and
operational (the rules to follow while working); this file is everything else —
history, reasoning, status, open questions, and the shorthand this project uses —
written so someone with zero prior exposure to this specific project could read it
once and be fully caught up. It intentionally overlaps with `CLAUDE.md`, `AGENTS.md`,
`README.md`, and the local build log (`notes.html`) rather than trying to avoid
duplication with them.

Last written: 2026-09-12, from the state of the repo and its uncommitted working
tree at that point. Treat anything time-sensitive here (open bugs, "current" state)
as a snapshot, not a live source of truth — check the code/git history for that.

---

## 1. Project purpose and origin story

**NoBounds** is an existing iOS app (native Swift, ~200,000 lines) built by **Shaan**
for people in long-distance friendships/relationships. It helps them stay connected
through shared photos, conversation prompts, small daily rituals (habits, "today's
prompt"), a virtual pet the couple raises together, cycle tracking, gift/date ideas,
and a handful of two-player games. Shaan owns and founded NoBounds and its
production backend.

**This repository (NoBounds-Android)** is an Android port of that app, being built
by one person (the primary author in git history and this project's day-to-day
developer — see "People" below) as an **unpaid, informal side project**, not
employment. Shaan invited this developer into the private iOS repo (`../NoBounds`,
a sibling folder, read-only) so the port could reference real screens, navigation,
and business logic instead of guessing.

### Why it exists

The stated reason (per `CLAUDE.md`, from Shaan directly) is **not** "we need an
Android app shipped." It's an experiment in AI-assisted migration: rather than
attempt a careful, correct, line-by-line port of 200,000+ lines of Swift up front
(judged unrealistic), the plan is to build a rough, fast prototype using AI coding
tools (Claude Code), "without much restraint," and see what breaks. Some features
will work well when AI-converted from the Swift reference; others won't. The
learnings from *this* phase are meant to inform how a real, production-grade
Android migration would eventually be scoped and executed — this repo is the
research vehicle for that decision, not (yet) the production app itself.

That framing matters a lot for how to read everything else in this document:
incomplete features, mock data, broken edge cases, and rapid unreviewed churn are
expected and acceptable right now. Polish and completeness are not the goal of
this phase.

---

## 2. History of major decisions

This section reconstructs the project's timeline from git history (`git log`) and
the local build log (`notes.html`, gitignored, not part of the repo but the richest
available account of *why* things happened). Commit hashes are included so this
can be cross-referenced later.

### Aug 12, 2026 — `bc9576a` "initial expo app setup"
Bare Expo/React Native project scaffolded. No NoBounds-specific structure yet.

### Aug 14, 2026 — `e7c1432` "Rebuilt app to have more similar structure and design to iOS version"
First real pass at matching the iOS app's actual look and navigation, rather than
a generic Expo starter layout.

### Aug 15, 2026 (per notes.html; not a distinct commit)
Habits became real (backed by Supabase instead of hardcoded sample tasks), profile
display name and appearance settings started persisting to the backend instead of
resetting on relaunch. This is also when the developer got read access to the real
NoBounds Supabase schema (Shaan's actual database structure) to use as a reference
for shaping the sandbox's own tables — notably for habits and the pairing/merge
logic.

### Aug 18, 2026 — four commits in one day
- `0f92d3d` "Wire habits to Supabase, add habit/memory/extensions screens, fix tab
  bar": habits went fully real with a **solo-first, merge-on-pair** design — a habit
  can exist with `couple_id = null` before pairing, then gets folded into the
  couple's shared scope via a `perform_couple_merge()` function once pairing
  completes. This solo→couple merge pattern was established here and reused for
  other domain tables later. Also fixed an Android-only rendering bug: applying a
  `backgroundColor` to an already-mounted view didn't reliably reapply
  `borderRadius`, making the selected-tab badge look square instead of a rounded
  capsule after navigating away and back.
- `f5dbfe7` "Remove AppPhotos and Notes.md from the repo": local reference
  screenshots and an early personal progress log were pulled out of version
  control (kept on disk, gitignored) — established the precedent that personal
  working artifacts don't belong in the repo, which is why `notes.html` (this
  project's current build log) is also gitignored today.
- `85fc617` "Add calendar month/week navigation, rewrite README, fix gitignore":
  the AppPhotos/Notes.md gitignore rule from the previous commit hadn't actually
  been added to `.gitignore` itself (only the tracked files were removed) — fixed
  here. README rewritten into its current architecture-table/setup-steps shape.
- `017c4a0` "Real Timeline filters + private storage with signed URLs": this is
  where the storage model still in use today was established — four **private**
  buckets (`avatars`, `presence`, `memory-photos`, `prompt-photos`) replacing one
  public bucket, nothing ever exposed via a public URL, only short-lived (1hr)
  signed URLs, a 5MB size cap and image-mime allowlist enforced at the bucket
  level, and RLS policies that derive ownership from the file path's own first
  segment (user ID, couple ID, or memory ID) rather than just "is logged in."
  Also introduced `timeline_feed()`, a Postgres function that unions memories,
  presence photos, prompt answers, and milestones into one sorted, paginated feed
  — the same function that turned out to have a schema-drift bug fixed much later
  (see section 5).

### Aug 25, 2026 — three commits
- `e29afb9` / `6476126`: a deliberate, non-functional, project-wide pass adding
  short lowercase inline comments across almost every screen, lib file, context,
  and component — explicit intent was to make the codebase easier to skim, not to
  change behavior. Also removed an unused legacy `Colors`/`ThemeColor` export.
- `98dc4ee` "Add profile photo upload, fix upload mime type/perf, add db grants":
  wired the profile "Change photo" flow to the `avatars` bucket. Along the way,
  fixed two real bugs: uploads were reading the wrong MIME type off local files
  (fixed by reading via `expo-file-system`'s `arrayBuffer()` instead of React
  Native's `Blob` polyfill, which round-trips bytes through base64 and loses the
  real MIME type — this is now the standard upload pattern used everywhere in the
  app, see `src/lib/storage.ts`), and a missing Postgres grant that was silently
  blocking writes before RLS even got a chance to run (schema.sql now explicitly
  grants table/function access rather than relying on defaults).

### Sep 1, 2026 — `8935e85` "Add Bound camera view, iOS-matching invite-code supersede logic"
**This is the last commit in git history as of this writing** — everything below
happened in the working tree and was never committed (see section 5's "uncommitted
work" callout). Two things landed here:
- **Bound** (the in-app camera feature — see "Terminology" for why it's called
  that) got a real camera view: viewfinder, flip, flash, retake, gated by
  `expo-camera`'s permission flow with an in-app message on denial rather than
  re-prompting. Capture-only at this point — no send/compose yet.
- **Pairing** invite codes now supersede any still-pending code from the same
  user instead of leaving multiple valid codes outstanding, matching how the real
  iOS app enforces "one active code per person" (a partial unique index plus an
  explicit supersede-on-create step in `create_couple_invite()`), plus a one-time
  cleanup of duplicate pending invites left over from earlier manual testing.

### Sep 4, 2026 (uncommitted; from notes.html)
Set up everything push notifications need to exist at all: a custom installable
dev-client build (since Expo Go can't do push notifications) and a real Firebase
project for Android's push delivery. Discovered mid-setup that this can't fully
work yet — the real backend's push infrastructure only speaks Apple's APNs
protocol, so there's currently no Android delivery path at all. This became the
first of the three recurring "ask Shaan" items (see section 6).

### Sep 7, 2026 (uncommitted; from notes.html) — the "connect to the real backend" pivot
notes.html's own account of this date is significant and should be treated with
some caution (see section 5, item 1, for why): it describes "connecting the
Android app to Shaan's real backend — not my own sandbox anymore," including
claims of having pulled the actual production database structure ("46 migration
files, 10 backend functions") to rewire the app table-by-table. Specific changes
attributed to this date: pairing and daily prompts rebuilt to call what were
believed to be the real backend's own Edge Functions instead of the simpler
Postgres-RPC version originally built for the sandbox; a "memories" naming
mismatch fixed, gaining multi-photo-per-memory support in the process; Bound
finished end-to-end (camera → caption/mood step → actually sends and shows up
for the partner); account deletion added; Draw & Guess built as a **live-only,
unpersisted** game (explicitly because, per the notes, a new table "wasn't
allowed" on the real backend) — genuinely more like a phone call than a saved
game state; and nine previously-mock screens (Pet, Flashcards, Date Ideas, Gift
Ideas, Weekly Share, Notifications, Cycle Tracking, Important Dates, Feedback)
turned over to real reads/writes.

**Important:** this is also exactly where the `functions.invoke('create-couple-invite')`
/ `functions.invoke('accept-couple-invite')` pattern was introduced into
`pairing.tsx`, which turned out to be a real, confirmed regression fixed later
the same day as this document was written (section 5). The same broken pattern
still exists, unfixed, in `prompt.tsx` and `account.tsx`.

### Sep 12, 2026 (uncommitted; from notes.html and this session) — largest single pass
Per notes.html: went through the iOS Swift source screen-by-screen "to stop
guessing and start matching exactly." Changes attributed to this date include:
Bound's tab now opens straight into the camera (matching iOS's
`presencefastsendflow`) instead of showing a photo list first; reactions moved
off a list and onto a dedicated single-photo detail screen with the real 6-emoji
set from the iOS app; the literal placeholder string "Partner" (instead of the
partner's real name) fixed across every screen that showed pairing status; the
Pet feature rebuilt almost entirely with real pixel-art sprite sheets and the
real hunger/happiness math (previously two static emoji with made-up numbers);
Home's layout reordered to match iOS; Timeline's generic backend label
("Presence photo") replaced with the client-computed "Bound - <date> - <time>"
formatting iOS uses; a habit reminder time-picker removed per a direct ask; new
reaction buttons added specifically because two notification types could never
fire without something writing to the tables they watch; a real bug fixed where
symptom severity in Cycle Tracking was silently hardcoded to "moderate" (meaning
a severe-symptom partner alert could never actually trigger); a reunion-date
setting added (also needed for a notification type to have anything to count
down to); and per-habit reminder times plus app-wide quiet hours added.

**Also on Sep 12, within this session specifically** (see section 5 for full
detail): three real bugs were found and two were fixed (Bound send/timeline-photo
schema drift, and the pairing Edge Function regression); two more instances of the
same Edge Function bug were found but *not yet fixed* (daily prompt, account
deletion); a `npm run android` launch failure was reported and partially
diagnosed but not resolved; and a new feature — the Profile "my photo / partner's
photo" toggle — was ported from iOS, matching its exact local-only,
`UserDefaults`-backed (here: `AsyncStorage`-backed) behavior.

### Approaches tried and abandoned
- **Public storage bucket for all photos** — the original approach (implicit in
  the pre-Aug-18 state) was a single public "memories" bucket. Abandoned Aug 18
  in favor of four private, RLS-scoped buckets with signed URLs, matching how the
  real iOS app actually handles photo privacy. Reason: a public bucket means any
  photo URL, if ever leaked or guessed, is viewable by anyone forever — not
  acceptable for a couples' private-photo app even in prototype form.
- **React Native's `Blob` polyfill for uploads** — abandoned Aug 25 in favor of
  reading files via `expo-file-system`'s `arrayBuffer()`. Reason: the Blob
  polyfill round-trips bytes through base64 and its own native store, which is
  both slow and silently loses the file's real MIME type, causing upload
  rejections.
- **Persisting Draw & Guess game state** — considered and abandoned (per the Sep 7
  notes) specifically because adding a new table on what was believed to be
  Shaan's real backend "wasn't allowed." Built instead as a purely live,
  in-memory, real-time connection with nothing saved — this decision is entangled
  with the unresolved real-backend question in section 5.
- **Calling Supabase Edge Functions to mirror iOS's real backend architecture** —
  attempted starting Sep 7 for pairing, daily prompts, and account deletion, on
  the belief the app was now targeting Shaan's real backend (which genuinely does
  use Edge Functions on iOS). This does not work against the actual sandbox
  Supabase project this app is configured against, which has zero deployed Edge
  Functions by design (see README's own architecture table: "no Edge Functions —
  plain SQL, since no Supabase CLI is required"). One of the three call sites
  (pairing) was reverted back to plain RPC calls in this session; the other two
  remain broken as of this writing.

---

## 3. Current architecture and stack

| Layer | Location | Notes |
|---|---|---|
| Framework | Expo SDK ~57.0.18, React Native 0.86.3, React 19.2.3 | React Compiler and typed routes experiments both enabled in `app.config.js` |
| Navigation | `src/app/_layout.tsx`, Expo Router file-based routes | 5-tab shell under `src/app/(tabs)/`; modal-style screens (pairing, memory-form, photo-detail, etc.) live flat under `src/app/` |
| Theme | `src/constants/palettes.ts`, `src/contexts/palette-context.tsx` | 5 semantic palettes ported hex-for-hex from iOS's `ThemeTokens`; light/dark/system mode |
| UI primitives | `src/components/` | `NBCard`, `NBPrimaryButton`, `ScreenHeader`, themed text/view wrappers, feature-specific components (pet sprite, draw-and-guess canvas, cycle-phase bar, etc.) |
| Session/auth | `src/contexts/session-context.tsx` | Wraps Supabase auth session, profile row, couple/pairing state, app settings, and (as of this session) the local avatar-source preference and its resolved signed URLs |
| Supabase client | `src/lib/supabase.ts` | Single SDK client boundary; session persisted via `@react-native-async-storage/async-storage`; helper functions for turning Postgrest/Storage error shapes into readable messages |
| Domain helpers | `src/lib/*.ts` | One file per feature area for data access (habits, timeline, pets, cycle-tracking, gift-ideas, date-ideas, weekly-share, notifications, feedback, flashcards, important-dates, avatar-preference, storage) |
| Backend | `supabase/schema.sql` | The single source of truth for the sandbox's tables, RLS policies, and RPC functions. Deliberately idempotent (every statement is `create ... if not exists` / `create or replace` / `drop policy if exists` + `create policy`) so it's safe to paste the whole file into the Supabase SQL editor any time, with no migration tooling or Supabase CLI required |
| Storage | 4 private buckets: `avatars`, `presence`, `memory-photos`, `prompt-photos` | No public URLs anywhere; every read goes through a client-generated 1-hour signed URL; 5MB size cap + image-mime allowlist enforced by the bucket itself; RLS derives the owning user/couple/memory from the object path's own first segment |
| Native config | `app.config.js` (dynamic, replaced the old static `app.json`), `eas.json` | Android package `com.shashank.noboundsandroid`, EAS project id `a380c0a8-56ac-4d18-8ebe-3127eaffdbf8`, EAS owner account `shashankn0s-team`; `google-services.json` is gitignored and supplied via an EAS build-time env var (`GOOGLE_SERVICES_JSON`) in CI, falling back to a local file for local builds |
| Dev/build tooling | `expo-dev-client` | A custom dev client build is required (not plain Expo Go) because of native modules the app already depends on — camera, notifications, and the custom Android permissions declared in `app.config.js` |

### Reasoning behind key choices
- **React Native + Expo over native Kotlin**: explicitly the developer's own
  choice, not something Shaan mandated. Justification recorded in `CLAUDE.md`:
  prior experience with Expo from an unrelated personal project made it faster
  to get a prototype moving than learning native Android development from
  scratch — directly serving the "speed and breadth over polish" goal of this
  phase.
- **Own sandbox Supabase project instead of Shaan's real backend**: stated
  explicitly in `CLAUDE.md` and `README.md` as a hard boundary for this phase —
  this Android port should not assume access to Shaan's production data or
  schema. (See section 5, item 1, for why this boundary appears to have been
  crossed at least once, and why that's flagged as unresolved rather than simply
  corrected.)
- **No Edge Functions / no Supabase CLI dependency**: a deliberate simplicity
  choice for the sandbox backend specifically — everything the backend needs to
  do is expressed as plain SQL (tables, RLS, `plpgsql`/`sql` functions) that a
  contributor can paste into the Supabase dashboard's SQL editor, with nothing
  that requires installing or authenticating the Supabase CLI. This is a sandbox
  simplification and is *not* how the real iOS backend is built (it does use real
  Edge Functions) — a source of confusion that caused the pairing/prompt/account
  bugs described in section 5.
- **Solo-first, merge-on-pair data model**: habits (and, per the Sep 7 notes,
  timeline memories are intended to eventually follow the same pattern) are
  designed to work before a couple ever pairs up, with a couple_id that starts
  null and gets backfilled by `perform_couple_merge()` once pairing completes —
  chosen so the app is immediately useful solo, matching how the real iOS app
  behaves before/after pairing rather than gating the whole app behind pairing.
- **Signed URLs everywhere, nothing public**: matches the real iOS app's own
  privacy model exactly, and was considered non-negotiable even during the
  "rapid prototype, don't worry about correctness" phase, since this is a
  couples' private-photo app.

---

## 4. Current status

### Built and working (per README + notes.html, both current as of Sep 12)
Auth (email/password against the sandbox, email confirmation disabled for
convenience), Pairing (create/accept invite code, one-active-code-per-person
supersede logic, solo→couple merge), Habits (solo + couple, completion tracking,
per-habit reminder times, app-wide quiet hours), Daily Prompts (answer, reveal
once both partners have answered — *note: the loading call itself is currently
broken, see section 5*), Timeline (real Memories/Photos/Prompts/Milestones/
Favorites filtering, real Bound-vs-Photo-vs-Memory row labeling and iOS-matching
date/time formatting, search), Memories (multi-photo, private storage), Profile
(display name, time zone, avatar upload, and — new this session — the "my photo /
partner's photo" featured-avatar toggle), Appearance (5 palettes, light/dark/
system, synced to the account), Bound (real in-app camera → caption/mood compose
step → send → shows up for the partner, single-photo detail screen with 6
reaction emoji and favorite/caption-edit), Pet (real sprite sheets, real 24-hour
hunger/happiness math, pet-chat), Cycle Tracking (mood/symptom logging including
severity, partner-sharing toggle), Date Ideas, Gift Ideas, Weekly Share
(message/quote/link), Notifications inbox, Important Dates (calendar
heart-badges), Feedback & Support, Account deletion UI (confirmation step present
— *backend call is currently broken*, see section 5), and all 3 Play games
including a live (unpersisted) Draw & Guess.

### Broken or incomplete right now
1. **Daily Prompt loading** (`src/app/(tabs)/prompt.tsx`) calls
   `supabase.functions.invoke('ensure-daily-prompt')`, an Edge Function that
   doesn't exist in this sandbox (no `supabase/functions` directory anywhere,
   and no matching entry in `schema.sql`). This will fail every time the prompt
   tab tries to load. **Not yet fixed.**
2. **Account deletion** (`src/app/account.tsx`) calls
   `supabase.functions.invoke('delete-account', ...)`, same problem — no such
   Edge Function exists. **Not yet fixed.**
3. **`npm run android` reportedly fails to launch** on the connected physical
   test device. Mid-session investigation found the device landing on Expo Dev
   Client's own `DevLauncherErrorActivity` (its built-in "couldn't load the
   project" error screen) with an already-running Metro process from an earlier
   `npm run android` still holding port 8081. The actual underlying error text
   (why the dev client couldn't connect/load) was **not extracted from logcat
   before the investigation was interrupted** — this is the most concrete
   "pick this up next" item in the whole document.
4. Push notifications: infrastructure (Firebase project, dev build, FCM
   plumbing) is built and presumed working, but there is nothing to actually
   send through it — the real backend's push table only has an `apns_token`
   column and its send function only speaks Apple's protocol. Needs a backend
   change only Shaan can make (see section 6).
5. Google Sign-In: not configured at all in Shaan's Supabase project (only
   Apple Sign-In is turned on there). Needs Shaan to flip a dashboard toggle.
6. Milestone auto-generation (e.g. "30 days together"): the table and RLS exist
   on both platforms, but nothing — on either iOS or this port — ever writes to
   it. No scheduled job has been built yet.
7. See section 5 for the unresolved question of which backend this app is
   actually supposed to be talking to, which several of the above items
   ultimately trace back to.

---

## 5. Open questions, known issues, and technical debt

### 1. Unresolved: which backend is this app actually supposed to use? *(high priority)*
`CLAUDE.md` and `README.md` are both explicit, repeated, and unambiguous: this
project uses **only** the developer's own personal sandbox Supabase project, and
must never assume access to Shaan's real/production backend or its schema.
`README.md`'s setup instructions even tell a new contributor, in bold, to create
"**not** Shaan's production project."

However, the local (gitignored, uncommitted-to-git) build log `notes.html`
contains a 2026-09-07 entry stating the app was "Connected... to Shaan's real
backend — not my own sandbox anymore," including a specific claim of having
pulled "the actual real database structure directly from the source (46
migration files, 10 backend functions)."

During this session, that claim was checked against the actual repository state
and does not hold up:
- No `supabase/functions` directory, no migration files, and no Edge Functions
  exist anywhere in this repo or the sandbox schema (`supabase/schema.sql`
  contains only plain `plpgsql`/`sql` functions).
- Three separate places in the client code (`pairing.tsx`, `prompt.tsx`,
  `account.tsx`) call `supabase.functions.invoke(...)` against Edge Function
  names that mirror the real iOS backend's naming convention
  (`create-couple-invite`, `ensure-daily-prompt`, `delete-account`) but that have
  never been deployed anywhere — not to the sandbox, and (as far as this repo's
  contents show) not visibly deployed to a real backend this app is actually
  wired to talk to either. Calling any of them currently just fails.
- `pairing.tsx`'s version of this bug was fixed in this session by reverting it
  to call the plain Postgres RPC functions (`create_couple_invite()` /
  `accept_couple_invite()`) that genuinely exist in `schema.sql` and clearly
  always worked before the Sep 7 change.

The most likely explanation is that an earlier AI-assisted session (Sep 7)
drifted from the sandbox-only instruction — possibly attempting to actually
integrate with real backend, possibly just writing client code that assumed
Edge Functions would be added without following through on the sandbox side —
and then wrote an overstated or partially fabricated account of what happened
into its own build log. This was surfaced to the user once already, mid-session,
via a clarifying question that was interrupted before an answer was given.

**This needs a definitive answer from the developer (and possibly Shaan) before
anyone does more work in this area.** Until it's resolved, treat `schema.sql` as
the actual source of truth for what the backend can do, and treat any client
code that assumes otherwise (Edge Functions, tables/columns not present in
`schema.sql`) as suspect and worth re-verifying against the schema before relying
on it.

### 2. Two known, unfixed instances of the Edge-Function-that-doesn't-exist bug
`prompt.tsx` (`ensure-daily-prompt`) and `account.tsx` (`delete-account`). Same
class of bug as the pairing regression fixed this session; same fix pattern
(revert to `supabase.rpc(...)`, and — pending resolution of item 1 above — add a
matching plain SQL function to `schema.sql` if one doesn't already exist under a
different name). Account deletion in particular is worth being careful with
given it's a destructive, irreversible operation — don't just wire it to a new
RPC without confirming what it's actually supposed to delete/cascade.

### 3. Large amount of uncommitted work
As of this writing, the last git commit is `8935e85` (Sep 1). Everything
attributed to Sep 4, Sep 7, and Sep 12 in notes.html — which is the large
majority of the app's current feature surface — exists only in the working
tree. `git status` currently shows 30+ modified files, several deleted files
(the old `app.json`, the old bound-camera screen now folded into the Bound tab
itself, and every remaining `src/lib/mock/*` file as features moved off mock
data), and around 20 new untracked files (new screens, new lib modules, new
components, `app.config.js`, `eas.json`). None of this has a commit history or
backup beyond what's on this one machine's disk. Worth committing in
reasonably-sized chunks soon, both for safety and so the git history actually
reflects what's been happening.

### 4. `npm run android` launch failure — unresolved
See section 4, item 3. Next step would be re-running
`adb logcat -d | grep -i devlauncher` (or similar) immediately after a fresh
launch attempt to capture the actual error text the Dev Client error screen is
displaying, rather than just the surrounding window-manager noise.

### 5. Play Store readiness is technically present but premature
`eas.json` and `app.config.js` are both configured well enough to run
`eas build --platform android --profile production` and `eas submit` today.
Google requires new developer accounts to run a closed test with 20+ testers for
14 continuous days before allowing a production release, which is a real clock
worth being aware of — but starting it now would mean spending it on a build
that still has the broken flows listed in section 4.

### 6. Draw & Guess persistence decision inherits the backend-scope question
Built as live-only/unpersisted specifically because a new table "wasn't allowed"
on what was believed to be the real backend at the time (Sep 7). Once item 1
above is resolved, it may turn out a table could in fact be added to the actual
sandbox this app should be using, which would change this design if persistence
is ever wanted.

---

## 6. People involved

- **Shaan** — owns and founded NoBounds, the original iOS/Swift app. Invited the
  developer into the private iOS repo (`../NoBounds`, read-only reference,
  never to be edited) and personally scoped this Android port's rapid-prototype
  phase and its goals. Owns the real/production NoBounds Supabase backend, which
  this project is explicitly not supposed to touch or assume access to during
  this phase (see section 5, item 1). Appears to have a recurring sync/meeting
  cadence with the developer — `notes.html` maintains a running "for today's
  meeting" section of open asks that only Shaan can act on (see below).
- **The developer** (git author `shashankn0`, associated email
  `snellutla26@gmail.com` per this session's environment) — builds the Android
  port. This is unpaid, informal collaboration on a side project, explicitly not
  employment by Shaan or any company. Owns the EAS account (`shashankn0s-team`)
  and the Android app identity (`com.shashank.noboundsandroid`) this project is
  built under.
- **Claude / Claude Code** — has done the majority of the hands-on
  implementation work across sessions (every commit message in git history since
  the initial setup carries a `Co-Authored-By: Claude` trailer, and `notes.html`
  narrates the work session-by-session in first person as "I"/"my"). The explicit
  point of this whole phase, per `CLAUDE.md`, is to observe what AI-assisted
  Swift-to-RN conversion handles well versus poorly, so this isn't incidental —
  Claude's own track record on this project (including the mistakes surfaced in
  section 5) is itself one of the intended outputs of the prototype phase.

---

## 7. Timeline and deadlines

- **Original scope**: Shaan's explicit guidance (recorded in `CLAUDE.md`) was a
  rough prototype built in **2-5 days**. In practice, the project has now run
  about a month (Aug 12 → Sep 12 per git history and the dated build log) and is
  still described as being in that same rapid-prototype phase — the original
  estimate has been well exceeded, without (as far as this repo shows) an
  explicit renegotiation of scope or timeline being recorded anywhere.
- **Recurring checkpoint**: `notes.html` maintains a "For today's meeting — 3
  things to ask Shaan" section that gets updated as items are resolved or added,
  implying a regular sync cadence with Shaan. As of Sep 12, the three live asks
  are: (1) add an optional `fcm_token` column plus an Android-specific send
  branch to the real backend's push-sending function, additive and non-breaking
  to the existing Apple path; (2) a one-time toggle to turn on Google Sign-In in
  Shaan's Supabase dashboard; (3) a new scheduled job on the real backend to
  auto-generate milestone rows (nothing else about this needs to change — iOS
  already reads from the milestones table, it would just start seeing real
  entries). All three require action on Shaan's real backend specifically, not
  further work in this repository.
- **No hard external ship date** is recorded anywhere in the repo or build log.
  The recurring meeting with Shaan is the only concrete, dated checkpoint found.

---

## 8. Terminology, naming conventions, and internal shorthand

- **"Bound"** — the iOS-branded name for the in-app camera / quick-photo-sharing
  feature: open the camera, snap a photo (or pick one from the library), add an
  optional caption/mood tag, and send it straight to your partner. It surfaces in
  Timeline (labeled "Bound" for camera captures, "Photo" for library picks — see
  `rowLabel()` in `src/lib/timeline.ts`) and on Home as a "last Bound" card. In
  casual conversation, "the bound" has been used as shorthand specifically for
  this feature (e.g., "the bound is broken" meant Bound photo capture/display,
  not the pairing/couple-connection relationship — those are different concepts
  and different words in this codebase.)
- **"Paired" / "pairing"** — the couple-connection relationship itself: two
  accounts joined via a one-time invite code
  (`create_couple_invite`/`accept_couple_invite`), after which they share a
  `couple_id`. Never referred to as "bound" anywhere in the app's own copy or
  code — that word is reserved for the photo feature above.
- **Solo vs. couple scope** — the recurring data-modeling pattern where a table
  (habits today; timeline memories eventually, per the Sep 7 notes) has a
  nullable `couple_id`: rows created before pairing are "solo" (scoped to just
  one `owner_user_id`), and get merged into the couple's shared scope by
  `perform_couple_merge()` once pairing completes. Nothing is deleted or
  overwritten in this merge — ownership is just re-scoped.
- **Featured avatar / avatar source** — informal name (not app-facing copy) for
  the Profile screen's "My photo" / "`<partner>`'s photo" toggle, added this
  session. Mirrors iOS's `ProfileAvatarSource` enum (`.mine` / `.partner`)
  exactly: a purely local, per-device preference (UserDefaults on iOS,
  `AsyncStorage` here via `src/lib/avatar-preference.ts`), never synced to the
  backend or visible to the partner's own device, controlling which of the two
  partners' photos is shown as "your" avatar in the app's own header/toolbar.
- **Sandbox vs. "the real backend"** — "sandbox" means the developer's own
  personal Supabase project, which is what this app's `.env.local` should always
  point at per `README.md`'s setup instructions. "The real backend" or "Shaan's
  real backend" means the actual production NoBounds Supabase project that the
  live iOS app talks to. This project is explicitly scoped to never touch the
  latter — see section 5, item 1, for the open question about whether that
  boundary has in fact been crossed.
- **`notes.html`** — a personal, gitignored, deliberately designed HTML build
  log kept locally (not in the repo). It replaced an earlier plain-text
  `Notes.md` (removed from the repo Aug 18, also gitignored going forward). Per a
  standing preference the developer has set, it's meant to be kept up to date
  after every major step and republished as a small styled artifact — it
  describes itself, in its own header, as "Build notes, plain terms," i.e.
  written for a non-technical reader (useful for exactly the kind of "what
  actually happened and why" context this document is trying to consolidate).
- **`AGENTS.md`** — a single-line file telling Claude that "Expo HAS CHANGED"
  and to read the exact versioned Expo v57 docs before writing code, rather than
  relying on possibly-outdated pretrained knowledge of an earlier Expo API
  shape.
- **`CLAUDE.md`** — the concise, operational counterpart to this file: project
  context, phase, tech decisions, and conventions, meant to be read every
  session. This file (`detailed_context.md`) is explicitly the longer, narrative
  version that doesn't need to be re-read every time but should be available for
  anyone (human or AI) trying to get fully oriented from scratch.
- **RLS** — Postgres Row-Level Security. This project's only authorization
  mechanism; there is no separate application-level permission-checking layer.
  Every table in `schema.sql` has RLS enabled with explicit per-operation
  policies.
- **"iOS-matching"** — a phrase that shows up repeatedly across commit messages
  and the build log, describing the project's default posture: don't invent new
  UX or data shapes, port the real iOS app's behavior, copy, and structure as
  closely as React Native reasonably allows, by actually reading `../NoBounds`
  first rather than guessing. This is also the explicit convention documented in
  `CLAUDE.md`: check the iOS Swift equivalent, explain what it does, then propose
  the RN version.
- **Row path convention for private storage** — `avatars/{userId}/{file}`,
  `presence/{coupleId}/{file}`, `memory-photos/{memoryId}/{file}`,
  `prompt-photos/{coupleId}/{file}`. RLS policies parse the first path segment
  out of the object name to determine ownership, via a shared
  `storage_owner_id()` SQL helper — worth knowing before adding any new bucket or
  upload path, since getting this convention wrong silently breaks RLS rather
  than throwing an obvious error.
