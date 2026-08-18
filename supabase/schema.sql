-- NoBounds-Android rough prototype schema
-- Paste this whole file into your Supabase project's SQL Editor and run it.
-- Safe to re-run any time — every table/column/policy/function statement is idempotent
-- (create table if not exists, add column if not exists, drop policy if exists + create policy,
-- create or replace function), so you don't need to wipe the project to pick up changes.

-- ============ profiles ============
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Someone',
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists time_zone text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- ============ user app settings (palette + appearance mode) ============
create table if not exists public.user_app_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  palette_id text not null default 'classic_rose',
  appearance_mode text not null default 'system' check (appearance_mode in ('system', 'light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_app_settings enable row level security;

drop policy if exists "user_app_settings_select_own" on public.user_app_settings;
create policy "user_app_settings_select_own" on public.user_app_settings
  for select using (user_id = auth.uid());
drop policy if exists "user_app_settings_insert_own" on public.user_app_settings;
create policy "user_app_settings_insert_own" on public.user_app_settings
  for insert with check (user_id = auth.uid());
drop policy if exists "user_app_settings_update_own" on public.user_app_settings;
create policy "user_app_settings_update_own" on public.user_app_settings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Bootstrap a profile row the first time a user signs in.
create or replace function public.ensure_own_profile()
returns public.profiles
language plpgsql
security definer set search_path = public
as $$
declare
  row public.profiles;
begin
  insert into public.profiles (id, display_name)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email', 'Someone'))
  on conflict (id) do nothing;

  insert into public.user_app_settings (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  select * into row from public.profiles where id = auth.uid();
  return row;
end;
$$;

-- ============ pairing ============
create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.couple_members (
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

create table if not exists public.couple_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.couple_invites enable row level security;

create or replace function public.is_couple_member(target_couple_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.couple_members
    where couple_id = target_couple_id and user_id = auth.uid()
  );
$$;

create or replace function public.current_couple_id()
returns uuid
language sql
security definer set search_path = public
stable
as $$
  select couple_id from public.couple_members where user_id = auth.uid() limit 1;
$$;

drop policy if exists "couples_select_member" on public.couples;
create policy "couples_select_member" on public.couples
  for select using (public.is_couple_member(id));

drop policy if exists "couple_members_select_own_couple" on public.couple_members;
create policy "couple_members_select_own_couple" on public.couple_members
  for select using (public.is_couple_member(couple_id));

drop policy if exists "couple_invites_select_own" on public.couple_invites;
create policy "couple_invites_select_own" on public.couple_invites
  for select using (created_by = auth.uid());

-- Atomically create a pending invite for the caller (mirrors iOS create-couple-invite edge function).
create or replace function public.create_couple_invite()
returns public.couple_invites
language plpgsql
security definer set search_path = public
as $$
declare
  new_code text;
  row public.couple_invites;
begin
  if exists (select 1 from public.couple_members where user_id = auth.uid()) then
    raise exception 'already_paired';
  end if;

  new_code := upper(substr(md5(random()::text), 1, 6));

  insert into public.couple_invites (code, created_by)
  values (new_code, auth.uid())
  returning * into row;

  return row;
end;
$$;

-- ============ habits (solo-first: usable before pairing, merged into the couple on accept) ============
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid references public.couples (id) on delete cascade,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  owner_scope text not null default 'mine' check (owner_scope in ('mine', 'yours', 'ours')),
  completion_policy text not null default 'either' check (completion_policy in ('either', 'both')),
  sort_order int4 not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  merged_at timestamptz
);

alter table public.habits enable row level security;

drop policy if exists "habits_solo_select" on public.habits;
create policy "habits_solo_select" on public.habits
  for select using (couple_id is null and owner_user_id = auth.uid());
drop policy if exists "habits_solo_insert" on public.habits;
create policy "habits_solo_insert" on public.habits
  for insert with check (couple_id is null and owner_user_id = auth.uid());
drop policy if exists "habits_solo_update" on public.habits;
create policy "habits_solo_update" on public.habits
  for update using (couple_id is null and owner_user_id = auth.uid()) with check (couple_id is null and owner_user_id = auth.uid());
drop policy if exists "habits_solo_delete" on public.habits;
create policy "habits_solo_delete" on public.habits
  for delete using (couple_id is null and owner_user_id = auth.uid());

drop policy if exists "habits_couple_select" on public.habits;
create policy "habits_couple_select" on public.habits
  for select using (couple_id is not null and public.is_couple_member(couple_id));
drop policy if exists "habits_couple_insert" on public.habits;
create policy "habits_couple_insert" on public.habits
  for insert with check (couple_id is not null and couple_id = public.current_couple_id() and owner_user_id = auth.uid());
drop policy if exists "habits_couple_update" on public.habits;
create policy "habits_couple_update" on public.habits
  for update using (couple_id is not null and public.is_couple_member(couple_id)) with check (couple_id is not null and public.is_couple_member(couple_id));
drop policy if exists "habits_couple_delete" on public.habits;
create policy "habits_couple_delete" on public.habits
  for delete using (couple_id is not null and public.is_couple_member(couple_id));

create table if not exists public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  completion_date date not null,
  completed boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (habit_id, user_id, completion_date)
);

alter table public.habit_completions enable row level security;

drop policy if exists "habit_completions_select" on public.habit_completions;
create policy "habit_completions_select" on public.habit_completions
  for select using (
    exists (
      select 1 from public.habits h where h.id = habit_id and (
        (h.couple_id is null and h.owner_user_id = auth.uid())
        or (h.couple_id is not null and public.is_couple_member(h.couple_id))
      )
    )
  );
drop policy if exists "habit_completions_insert" on public.habit_completions;
create policy "habit_completions_insert" on public.habit_completions
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.habits h where h.id = habit_id and (
        (h.couple_id is null and h.owner_user_id = auth.uid())
        or (h.couple_id is not null and public.is_couple_member(h.couple_id))
      )
    )
  );
drop policy if exists "habit_completions_update" on public.habit_completions;
create policy "habit_completions_update" on public.habit_completions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "habit_completions_delete" on public.habit_completions;
create policy "habit_completions_delete" on public.habit_completions
  for delete using (user_id = auth.uid());

-- ============ solo -> couple merge ============
create table if not exists public.couple_merge_runs (
  couple_id uuid primary key references public.couples (id) on delete cascade,
  inviter_user_id uuid not null,
  acceptor_user_id uuid not null,
  completed_at timestamptz not null default now()
);

alter table public.couple_merge_runs enable row level security;

drop policy if exists "couple_merge_runs_deny_all" on public.couple_merge_runs;
create policy "couple_merge_runs_deny_all" on public.couple_merge_runs
  for all using (false) with check (false);

-- Re-scopes each partner's pre-pairing solo habits into the new couple. Idempotent — safe to call
-- more than once for the same couple. (Timeline memories aren't solo-capable yet; that's a later pass.)
create or replace function public.perform_couple_merge(p_couple_id uuid, p_inviter_id uuid, p_acceptor_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (select 1 from public.couple_merge_runs where couple_id = p_couple_id) then
    return;
  end if;

  update public.habits
    set couple_id = p_couple_id, merged_at = now()
    where couple_id is null and owner_user_id in (p_inviter_id, p_acceptor_id);

  insert into public.couple_merge_runs (couple_id, inviter_user_id, acceptor_user_id)
  values (p_couple_id, p_inviter_id, p_acceptor_id)
  on conflict (couple_id) do nothing;
end;
$$;

-- Atomically accept an invite by code (mirrors iOS accept-couple-invite edge function).
create or replace function public.accept_couple_invite(invite_code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  invite public.couple_invites;
  new_couple_id uuid;
begin
  select * into invite from public.couple_invites
  where code = upper(invite_code) for update;

  if invite.id is null then
    raise exception 'invite_not_found';
  end if;
  if invite.status <> 'pending' then
    raise exception 'invite_already_used';
  end if;
  if invite.expires_at < now() then
    raise exception 'invite_expired';
  end if;
  if invite.created_by = auth.uid() then
    raise exception 'cannot_pair_with_self';
  end if;
  if exists (select 1 from public.couple_members where user_id = auth.uid()) then
    raise exception 'already_paired';
  end if;

  insert into public.couples default values returning id into new_couple_id;

  insert into public.couple_members (couple_id, user_id)
  values (new_couple_id, invite.created_by), (new_couple_id, auth.uid());

  update public.couple_invites set status = 'accepted' where id = invite.id;

  perform public.perform_couple_merge(new_couple_id, invite.created_by, auth.uid());

  return new_couple_id;
end;
$$;

-- ============ daily prompts ============
create table if not exists public.prompt_templates (
  id uuid primary key default gen_random_uuid(),
  text text not null unique
);

insert into public.prompt_templates (text) values
  ('What''s something small that made you smile today?'),
  ('If we were together right now, what would we be doing?'),
  ('What''s a memory of us you''ve thought about recently?'),
  ('What''s one thing you''re looking forward to?'),
  ('Describe your day in three words.'),
  ('What''s something you want to try together?'),
  ('What made you think of me today?'),
  ('What''s your favorite thing about us right now?'),
  ('What''s a song that reminds you of me?'),
  ('If you could teleport here for one hour, what would we do?')
on conflict (text) do nothing;

create table if not exists public.couple_daily_prompts (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  prompt_template_id uuid not null references public.prompt_templates (id),
  prompt_date date not null,
  created_at timestamptz not null default now(),
  unique (couple_id, prompt_date)
);

create table if not exists public.prompt_answers (
  id uuid primary key default gen_random_uuid(),
  couple_daily_prompt_id uuid not null references public.couple_daily_prompts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  answer_text text not null,
  created_at timestamptz not null default now(),
  unique (couple_daily_prompt_id, user_id)
);

alter table public.couple_daily_prompts enable row level security;
alter table public.prompt_answers enable row level security;

drop policy if exists "couple_daily_prompts_member" on public.couple_daily_prompts;
create policy "couple_daily_prompts_member" on public.couple_daily_prompts
  for select using (public.is_couple_member(couple_id));
drop policy if exists "couple_daily_prompts_insert_member" on public.couple_daily_prompts;
create policy "couple_daily_prompts_insert_member" on public.couple_daily_prompts
  for insert with check (public.is_couple_member(couple_id));

drop policy if exists "prompt_answers_select_couple" on public.prompt_answers;
create policy "prompt_answers_select_couple" on public.prompt_answers
  for select using (
    exists (
      select 1 from public.couple_daily_prompts cdp
      where cdp.id = couple_daily_prompt_id and public.is_couple_member(cdp.couple_id)
    )
  );
drop policy if exists "prompt_answers_insert_own" on public.prompt_answers;
create policy "prompt_answers_insert_own" on public.prompt_answers
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.couple_daily_prompts cdp
      where cdp.id = couple_daily_prompt_id and public.is_couple_member(cdp.couple_id)
    )
  );

-- Get-or-create today's prompt for the caller's couple.
create or replace function public.get_or_create_todays_prompt()
returns public.couple_daily_prompts
language plpgsql
security definer set search_path = public
as $$
declare
  my_couple_id uuid;
  row public.couple_daily_prompts;
  template_id uuid;
begin
  select couple_id into my_couple_id from public.couple_members where user_id = auth.uid();
  if my_couple_id is null then
    raise exception 'not_paired';
  end if;

  select * into row from public.couple_daily_prompts
  where couple_id = my_couple_id and prompt_date = current_date;

  if row.id is null then
    select id into template_id from public.prompt_templates order by random() limit 1;

    insert into public.couple_daily_prompts (couple_id, prompt_template_id, prompt_date)
    values (my_couple_id, template_id, current_date)
    on conflict (couple_id, prompt_date) do nothing
    returning * into row;

    if row.id is null then
      select * into row from public.couple_daily_prompts
      where couple_id = my_couple_id and prompt_date = current_date;
    end if;
  end if;

  return row;
end;
$$;

-- ============ timeline ============
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  caption text not null,
  photo_url text,
  created_at timestamptz not null default now()
);

-- photo_path replaces photo_url going forward: a bare storage path in the private
-- memory-photos bucket, resolved to a signed URL client-side. photo_url is kept (unused) rather
-- than renamed, since Postgres has no RENAME COLUMN IF EXISTS and this keeps the file idempotent.
alter table public.memories add column if not exists photo_path text;

alter table public.memories enable row level security;

drop policy if exists "memories_select_couple" on public.memories;
create policy "memories_select_couple" on public.memories
  for select using (public.is_couple_member(couple_id));
drop policy if exists "memories_insert_couple" on public.memories;
create policy "memories_insert_couple" on public.memories
  for insert with check (public.is_couple_member(couple_id) and author_id = auth.uid());

-- ============ timeline: unified feed (mirrors iOS's timeline_feed RPC) ============
-- presence_photos: nothing writes to this yet (Bound's camera capture isn't wired up in this
-- prototype), but the table + RLS exist so the "Photos" filter has a real, empty source instead
-- of being unbuildable — and so Bound can start writing here later without a schema change.
create table if not exists public.presence_photos (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text,
  caption text,
  mood_tag text,
  created_at timestamptz not null default now()
);

alter table public.presence_photos enable row level security;

drop policy if exists "presence_photos_select" on public.presence_photos;
create policy "presence_photos_select" on public.presence_photos
  for select using (public.is_couple_member(couple_id));
drop policy if exists "presence_photos_insert" on public.presence_photos;
create policy "presence_photos_insert" on public.presence_photos
  for insert with check (user_id = auth.uid() and public.is_couple_member(couple_id));
drop policy if exists "presence_photos_update_own" on public.presence_photos;
create policy "presence_photos_update_own" on public.presence_photos
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "presence_photos_delete_own" on public.presence_photos;
create policy "presence_photos_delete_own" on public.presence_photos
  for delete using (user_id = auth.uid());

-- timeline_milestones: no auto-generator (e.g. "30 days together") exists yet either — couple
-- members can still read/write rows here directly, matching iOS's RLS, so this is ready for
-- whichever milestone-generation logic gets built later.
create table if not exists public.timeline_milestones (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  milestone_key text not null,
  title text not null,
  body text,
  occurred_at timestamptz not null default now(),
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.timeline_milestones enable row level security;

drop policy if exists "timeline_milestones_select" on public.timeline_milestones;
create policy "timeline_milestones_select" on public.timeline_milestones
  for select using (public.is_couple_member(couple_id));
drop policy if exists "timeline_milestones_insert" on public.timeline_milestones;
create policy "timeline_milestones_insert" on public.timeline_milestones
  for insert with check (
    public.is_couple_member(couple_id)
    and (created_by_user_id is null or created_by_user_id = auth.uid())
  );
drop policy if exists "timeline_milestones_update" on public.timeline_milestones;
create policy "timeline_milestones_update" on public.timeline_milestones
  for update using (public.is_couple_member(couple_id)) with check (public.is_couple_member(couple_id));
drop policy if exists "timeline_milestones_delete" on public.timeline_milestones;
create policy "timeline_milestones_delete" on public.timeline_milestones
  for delete using (public.is_couple_member(couple_id));

-- timeline_favorites: a generic star, works across all four item types — mirrors iOS exactly.
create table if not exists public.timeline_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type text not null check (entity_type in ('memory', 'photo', 'prompt', 'milestone')),
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, entity_type, entity_id)
);

alter table public.timeline_favorites enable row level security;

drop policy if exists "timeline_favorites_select_own" on public.timeline_favorites;
create policy "timeline_favorites_select_own" on public.timeline_favorites
  for select using (user_id = auth.uid());
drop policy if exists "timeline_favorites_insert_own" on public.timeline_favorites;
create policy "timeline_favorites_insert_own" on public.timeline_favorites
  for insert with check (user_id = auth.uid());
drop policy if exists "timeline_favorites_delete_own" on public.timeline_favorites;
create policy "timeline_favorites_delete_own" on public.timeline_favorites
  for delete using (user_id = auth.uid());

-- Unions memories/photos/prompts/milestones into one sorted, cursor-paginated feed — same shape
-- and rules as iOS's `timeline_feed` RPC:
--   * item_types = null means "no type filter", but milestones are excluded from that unfiltered
--     view (and from every filter except an explicit milestone filter) — matching iOS's
--     `visibleItems` client-side rule that milestones only show up when deliberately selected.
--   * favorites_only intersects with the same milestone-exclusion rule (favorites is not itself
--     a type filter).
--   * A "prompt" item only appears once both partners have answered (i.e. revealed).
create or replace function public.timeline_feed(
  p_limit int,
  p_before timestamptz default null,
  p_before_item_id text default null,
  p_item_types text[] default null,
  p_favorites_only boolean default false,
  p_search text default null,
  p_on_date date default null
)
returns table (
  item_type text,
  item_id text,
  occurred_at timestamptz,
  title text,
  subtitle text,
  entity_type text,
  entity_id uuid,
  is_favorite boolean
)
language plpgsql
security definer set search_path = public
stable
as $$
declare
  my_couple_id uuid;
begin
  select couple_id into my_couple_id from public.couple_members where user_id = auth.uid();
  if my_couple_id is null then
    return;
  end if;

  return query
  with unified as (
    select 'memory'::text as item_type, m.id::text as item_id, m.created_at as occurred_at,
           m.caption as title, null::text as subtitle, 'memory'::text as entity_type, m.id as entity_id
    from public.memories m
    where m.couple_id = my_couple_id

    union all

    select 'photo'::text, p.id::text, p.created_at,
           coalesce(p.caption, 'Partner presence'), p.mood_tag, 'photo'::text, p.id
    from public.presence_photos p
    where p.couple_id = my_couple_id

    union all

    select 'prompt'::text, cdp.id::text, cdp.created_at,
           pt.text, null::text, 'prompt'::text, cdp.id
    from public.couple_daily_prompts cdp
    join public.prompt_templates pt on pt.id = cdp.prompt_template_id
    where cdp.couple_id = my_couple_id
      and (select count(*) from public.prompt_answers pa where pa.couple_daily_prompt_id = cdp.id) >= 2

    union all

    select 'milestone'::text, tm.id::text, tm.occurred_at,
           tm.title, tm.body, 'milestone'::text, tm.id
    from public.timeline_milestones tm
    where tm.couple_id = my_couple_id
  ),
  favorited as (
    select
      u.*,
      exists (
        select 1 from public.timeline_favorites f
        where f.user_id = auth.uid() and f.entity_type = u.entity_type and f.entity_id = u.entity_id
      ) as is_favorite
    from unified u
  )
  select f.item_type, f.item_id, f.occurred_at, f.title, f.subtitle, f.entity_type, f.entity_id, f.is_favorite
  from favorited f
  where (p_item_types is null or f.item_type = any(p_item_types))
    and (not p_favorites_only or f.is_favorite)
    and (p_search is null or f.title ilike '%' || p_search || '%')
    and (p_on_date is null or f.occurred_at::date = p_on_date)
    and (p_before is null or f.occurred_at < p_before
         or (f.occurred_at = p_before and f.item_id < p_before_item_id))
    and (f.item_type <> 'milestone' or (p_item_types is not null and 'milestone' = any(p_item_types)))
  order by f.occurred_at desc, f.item_id desc
  limit p_limit;
end;
$$;

-- ============ storage: private buckets + signed URLs + path-based ownership ============
-- Note: storage.objects/storage.buckets live in the `storage` schema, not `public` — if you ever
-- reset with `drop schema public cascade`, these survive and this section alone stays re-runnable.
--
-- Mirrors the real NoBounds iOS storage model: four private buckets (no public URLs — every
-- read goes through a short-lived signed URL, generated client-side via
-- supabase.storage.from(bucket).createSignedUrl()), a 5MB size cap + image-only mime allowlist
-- enforced by the bucket itself, and RLS that re-derives the owning user/couple/memory from the
-- file's own path (its first path segment) rather than trusting "any authenticated user".
--
-- Path convention: avatars/{userId}/{file}, presence/{coupleId}/{file},
-- memory-photos/{memoryId}/{file}, prompt-photos/{coupleId}/{file}.
--
-- The `on conflict ... do update set public = false, ...` on every insert below doubles as a
-- standing hardening check: re-running this file always forces these buckets back to private
-- with the right limits, even if something toggled them in the dashboard.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/heic', 'image/heif']),
  ('presence', 'presence', false, 5242880, array['image/jpeg', 'image/png', 'image/heic', 'image/heif']),
  ('memory-photos', 'memory-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/heic', 'image/heif']),
  ('prompt-photos', 'prompt-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/heic', 'image/heif'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Extracts the owning ID from an object's path (its first "folder" segment). One shared helper
-- for all four buckets — iOS has three near-identical, separately-named versions of this same
-- one-liner; this is the same logic, DRY'd into one.
create or replace function public.storage_owner_id(object_name text)
returns uuid
language sql
stable
as $$
  select nullif((storage.foldername(object_name))[1], '')::uuid;
$$;

-- Does the caller belong to a couple that has this memory?
create or replace function public.can_access_memory(p_memory_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.memories m
    where m.id = p_memory_id and public.is_couple_member(m.couple_id)
  );
$$;

-- avatars: owned by the uploading user; readable by them or their paired partner.
drop policy if exists "avatars_select_own_or_partner" on storage.objects;
create policy "avatars_select_own_or_partner" on storage.objects
  for select using (
    bucket_id = 'avatars'
    and (
      public.storage_owner_id(name) = auth.uid()
      or exists (
        select 1 from public.couple_members self_member
        join public.couple_members partner_member on partner_member.couple_id = self_member.couple_id
        where self_member.user_id = auth.uid()
          and partner_member.user_id = public.storage_owner_id(name)
      )
    )
  );
drop policy if exists "avatars_write_own" on storage.objects;
create policy "avatars_write_own" on storage.objects
  for insert with check (bucket_id = 'avatars' and public.storage_owner_id(name) = auth.uid());
drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update using (bucket_id = 'avatars' and public.storage_owner_id(name) = auth.uid());
drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete using (bucket_id = 'avatars' and public.storage_owner_id(name) = auth.uid());

-- presence: owned by the couple (path is {coupleId}/...).
drop policy if exists "presence_access_couple" on storage.objects;
create policy "presence_access_couple" on storage.objects
  for all using (bucket_id = 'presence' and public.is_couple_member(public.storage_owner_id(name)))
  with check (bucket_id = 'presence' and public.is_couple_member(public.storage_owner_id(name)));

-- prompt-photos: same shape as presence.
drop policy if exists "prompt_photos_access_couple" on storage.objects;
create policy "prompt_photos_access_couple" on storage.objects
  for all using (bucket_id = 'prompt-photos' and public.is_couple_member(public.storage_owner_id(name)))
  with check (bucket_id = 'prompt-photos' and public.is_couple_member(public.storage_owner_id(name)));

-- memory-photos: owned by the memory itself (path is {memoryId}/...).
drop policy if exists "memory_photos_access" on storage.objects;
create policy "memory_photos_access" on storage.objects
  for all using (bucket_id = 'memory-photos' and public.can_access_memory(public.storage_owner_id(name)))
  with check (bucket_id = 'memory-photos' and public.can_access_memory(public.storage_owner_id(name)));
