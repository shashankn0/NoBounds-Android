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

-- 'superseded' added to match ios: generating a new code retires the old one rather than
-- leaving both valid. re-adding the check constraint since create table if not exists won't
-- widen it on a database that already has this table.
alter table public.couple_invites drop constraint if exists couple_invites_status_check;
alter table public.couple_invites add constraint couple_invites_status_check
  check (status in ('pending', 'accepted', 'expired', 'superseded'));

-- one-time cleanup: testing before this constraint existed left some people with more than
-- one pending invite. keep only the newest pending row per person, retire the rest, so the
-- unique index below can actually be built. harmless to re-run — once there's only one
-- pending row per person left, this updates nothing.
update public.couple_invites ci
set status = 'superseded'
where ci.status = 'pending'
  and ci.id <> (
    select ci2.id from public.couple_invites ci2
    where ci2.created_by = ci.created_by and ci2.status = 'pending'
    order by ci2.created_at desc
    limit 1
  );

-- mirrors ios's partial unique index: only one pending invite per person at a time. this is
-- the hard backstop — create_couple_invite() also explicitly supersedes the old one below, but
-- this catches the rare case of two concurrent calls racing each other.
create unique index if not exists couple_invites_one_pending_per_inviter
  on public.couple_invites (created_by) where status = 'pending';

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

  -- retire any still-pending invite from this user first — mirrors ios: only one active
  -- code at a time, so generating a new one always replaces the old one, never adds to it.
  update public.couple_invites
  set status = 'superseded'
  where created_by = auth.uid() and status = 'pending';

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
-- presence_photos: written to by Bound (PhotosScreen's onSend) on capture or library pick.
create table if not exists public.presence_photos (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text,
  caption text,
  mood_tag text,
  created_at timestamptz not null default now()
);

-- capture_source distinguishes Bound's in-app camera from a library pick (see PhotosScreen /
-- database-types.ts) — added after the table above, since photos.tsx's insert already writes it.
alter table public.presence_photos add column if not exists capture_source text not null default 'camera';
alter table public.presence_photos drop constraint if exists presence_photos_capture_source_check;
alter table public.presence_photos add constraint presence_photos_capture_source_check
  check (capture_source in ('camera', 'library'));

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
  is_favorite boolean,
  metadata jsonb
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
           m.caption as title, null::text as subtitle, 'memory'::text as entity_type, m.id as entity_id,
           '{}'::jsonb as metadata
    from public.memories m
    where m.couple_id = my_couple_id

    union all

    -- metadata carries what the client's timeline row formatter needs to tell a Bound (camera)
    -- capture from a library-picked photo, and to resolve its thumbnail (see timeline.ts/tsx)
    select 'photo'::text, p.id::text, p.created_at,
           coalesce(p.caption, 'Partner presence'), p.mood_tag, 'photo'::text, p.id,
           jsonb_build_object('storage_path', p.storage_path, 'mood_tag', p.mood_tag, 'capture_source', p.capture_source)
    from public.presence_photos p
    where p.couple_id = my_couple_id

    union all

    select 'prompt'::text, cdp.id::text, cdp.created_at,
           pt.text, null::text, 'prompt'::text, cdp.id,
           '{}'::jsonb
    from public.couple_daily_prompts cdp
    join public.prompt_templates pt on pt.id = cdp.prompt_template_id
    where cdp.couple_id = my_couple_id
      and (select count(*) from public.prompt_answers pa where pa.couple_daily_prompt_id = cdp.id) >= 2

    union all

    select 'milestone'::text, tm.id::text, tm.occurred_at,
           tm.title, tm.body, 'milestone'::text, tm.id,
           '{}'::jsonb
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
  select f.item_type, f.item_id, f.occurred_at, f.title, f.subtitle, f.entity_type, f.entity_id, f.is_favorite, f.metadata
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

-- ============ flashcards (Play tab language games) ============
-- content is read-only for clients; mirrors iOS's flashcard_decks/flashcard_cards catalog.
create table if not exists public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  language_key text not null check (language_key in ('spanish', 'japanese')),
  title text not null,
  subtitle text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.flashcard_cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.flashcard_decks (id) on delete cascade,
  front_text text not null,
  back_text text not null,
  reading_text text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  -- lets the seed data below be re-run safely instead of duplicating every card each time
  unique (deck_id, sort_order)
);

create index if not exists flashcard_decks_language_sort_idx
  on public.flashcard_decks (language_key, sort_order);
create index if not exists flashcard_cards_deck_sort_idx
  on public.flashcard_cards (deck_id, sort_order);

alter table public.flashcard_decks enable row level security;
alter table public.flashcard_cards enable row level security;

drop policy if exists "flashcard_decks_select" on public.flashcard_decks;
create policy "flashcard_decks_select" on public.flashcard_decks
  for select to authenticated using (active = true);

drop policy if exists "flashcard_cards_select" on public.flashcard_cards;
create policy "flashcard_cards_select" on public.flashcard_cards
  for select to authenticated using (active = true);

-- fixed ids (matching iOS's real deck ids) so this file stays re-runnable
insert into public.flashcard_decks (id, language_key, title, subtitle, sort_order) values
  ('a1000001-0000-4000-8000-000000000001', 'spanish', 'Spanish Basics', '180 essential words & phrases', 0),
  ('a1000002-0000-4000-8000-000000000002', 'japanese', 'Japanese Basics', '180 essential words & phrases', 0)
on conflict (id) do update set
  language_key = excluded.language_key,
  title = excluded.title,
  subtitle = excluded.subtitle;

insert into public.flashcard_cards (deck_id, front_text, back_text, sort_order) values
  ('a1000001-0000-4000-8000-000000000001', 'Hola', 'Hello', 0),
  ('a1000001-0000-4000-8000-000000000001', 'Buenos días', 'Good morning', 1),
  ('a1000001-0000-4000-8000-000000000001', 'Buenas tardes', 'Good afternoon', 2),
  ('a1000001-0000-4000-8000-000000000001', 'Buenas noches', 'Good evening / Good night', 3),
  ('a1000001-0000-4000-8000-000000000001', 'Adiós', 'Goodbye', 4),
  ('a1000001-0000-4000-8000-000000000001', 'Por favor', 'Please', 5),
  ('a1000001-0000-4000-8000-000000000001', 'Gracias', 'Thank you', 6),
  ('a1000001-0000-4000-8000-000000000001', 'De nada', 'You''re welcome', 7),
  ('a1000001-0000-4000-8000-000000000001', 'Lo siento', 'I''m sorry', 8),
  ('a1000001-0000-4000-8000-000000000001', '¿Cómo estás?', 'How are you?', 9),
  ('a1000001-0000-4000-8000-000000000001', 'Estoy bien', 'I''m fine', 10),
  ('a1000001-0000-4000-8000-000000000001', 'Mucho gusto', 'Nice to meet you', 11),
  ('a1000001-0000-4000-8000-000000000001', 'Te amo', 'I love you', 12),
  ('a1000001-0000-4000-8000-000000000001', 'Te extraño', 'I miss you', 13),
  ('a1000001-0000-4000-8000-000000000001', 'Sí', 'Yes', 14),
  ('a1000001-0000-4000-8000-000000000001', 'No', 'No', 15),
  ('a1000001-0000-4000-8000-000000000001', '¿Qué tal?', 'What''s up?', 16),
  ('a1000001-0000-4000-8000-000000000001', 'Hasta luego', 'See you later', 17),
  ('a1000001-0000-4000-8000-000000000001', 'Uno', 'One', 18),
  ('a1000001-0000-4000-8000-000000000001', 'Dos', 'Two', 19),
  ('a1000001-0000-4000-8000-000000000001', 'Tres', 'Three', 20),
  ('a1000001-0000-4000-8000-000000000001', 'Cuatro', 'Four', 21),
  ('a1000001-0000-4000-8000-000000000001', 'Cinco', 'Five', 22),
  ('a1000001-0000-4000-8000-000000000001', 'Seis', 'Six', 23),
  ('a1000001-0000-4000-8000-000000000001', 'Siete', 'Seven', 24),
  ('a1000001-0000-4000-8000-000000000001', 'Ocho', 'Eight', 25),
  ('a1000001-0000-4000-8000-000000000001', 'Nueve', 'Nine', 26),
  ('a1000001-0000-4000-8000-000000000001', 'Diez', 'Ten', 27),
  ('a1000001-0000-4000-8000-000000000001', 'Once', 'Eleven', 28),
  ('a1000001-0000-4000-8000-000000000001', 'Doce', 'Twelve', 29),
  ('a1000001-0000-4000-8000-000000000001', 'Trece', 'Thirteen', 30),
  ('a1000001-0000-4000-8000-000000000001', 'Catorce', 'Fourteen', 31),
  ('a1000001-0000-4000-8000-000000000001', 'Quince', 'Fifteen', 32),
  ('a1000001-0000-4000-8000-000000000001', 'Dieciséis', 'Sixteen', 33),
  ('a1000001-0000-4000-8000-000000000001', 'Diecisiete', 'Seventeen', 34),
  ('a1000001-0000-4000-8000-000000000001', 'Dieciocho', 'Eighteen', 35),
  ('a1000001-0000-4000-8000-000000000001', 'Diecinueve', 'Nineteen', 36),
  ('a1000001-0000-4000-8000-000000000001', 'Veinte', 'Twenty', 37),
  ('a1000001-0000-4000-8000-000000000001', 'Veintiuno', 'Twenty-one', 38),
  ('a1000001-0000-4000-8000-000000000001', 'Veintidós', 'Twenty-two', 39),
  ('a1000001-0000-4000-8000-000000000001', 'Veinticinco', 'Twenty-five', 40),
  ('a1000001-0000-4000-8000-000000000001', 'Treinta', 'Thirty', 41),
  ('a1000001-0000-4000-8000-000000000001', 'Rojo', 'Red', 42),
  ('a1000001-0000-4000-8000-000000000001', 'Azul', 'Blue', 43),
  ('a1000001-0000-4000-8000-000000000001', 'Verde', 'Green', 44),
  ('a1000001-0000-4000-8000-000000000001', 'Amarillo', 'Yellow', 45),
  ('a1000001-0000-4000-8000-000000000001', 'Negro', 'Black', 46),
  ('a1000001-0000-4000-8000-000000000001', 'Blanco', 'White', 47),
  ('a1000001-0000-4000-8000-000000000001', 'Rosa', 'Pink', 48),
  ('a1000001-0000-4000-8000-000000000001', 'Morado', 'Purple', 49),
  ('a1000001-0000-4000-8000-000000000001', 'Naranja', 'Orange', 50),
  ('a1000001-0000-4000-8000-000000000001', 'Gris', 'Gray', 51),
  ('a1000001-0000-4000-8000-000000000001', 'Madre', 'Mother', 52),
  ('a1000001-0000-4000-8000-000000000001', 'Padre', 'Father', 53),
  ('a1000001-0000-4000-8000-000000000001', 'Hermano', 'Brother', 54),
  ('a1000001-0000-4000-8000-000000000001', 'Hermana', 'Sister', 55),
  ('a1000001-0000-4000-8000-000000000001', 'Hijo', 'Son', 56),
  ('a1000001-0000-4000-8000-000000000001', 'Hija', 'Daughter', 57),
  ('a1000001-0000-4000-8000-000000000001', 'Abuelo', 'Grandfather', 58),
  ('a1000001-0000-4000-8000-000000000001', 'Abuela', 'Grandmother', 59),
  ('a1000001-0000-4000-8000-000000000001', 'Esposo', 'Husband', 60),
  ('a1000001-0000-4000-8000-000000000001', 'Esposa', 'Wife', 61),
  ('a1000001-0000-4000-8000-000000000001', 'Familia', 'Family', 62),
  ('a1000001-0000-4000-8000-000000000001', 'Amigo', 'Friend', 63),
  ('a1000001-0000-4000-8000-000000000001', 'Amiga', 'Friend (female)', 64),
  ('a1000001-0000-4000-8000-000000000001', 'Bebé', 'Baby', 65),
  ('a1000001-0000-4000-8000-000000000001', 'Niño', 'Boy', 66),
  ('a1000001-0000-4000-8000-000000000001', 'Agua', 'Water', 67),
  ('a1000001-0000-4000-8000-000000000001', 'Pan', 'Bread', 68),
  ('a1000001-0000-4000-8000-000000000001', 'Leche', 'Milk', 69),
  ('a1000001-0000-4000-8000-000000000001', 'Café', 'Coffee', 70),
  ('a1000001-0000-4000-8000-000000000001', 'Té', 'Tea', 71),
  ('a1000001-0000-4000-8000-000000000001', 'Arroz', 'Rice', 72),
  ('a1000001-0000-4000-8000-000000000001', 'Pollo', 'Chicken', 73),
  ('a1000001-0000-4000-8000-000000000001', 'Pescado', 'Fish', 74),
  ('a1000001-0000-4000-8000-000000000001', 'Fruta', 'Fruit', 75),
  ('a1000001-0000-4000-8000-000000000001', 'Verdura', 'Vegetable', 76),
  ('a1000001-0000-4000-8000-000000000001', 'Desayuno', 'Breakfast', 77),
  ('a1000001-0000-4000-8000-000000000001', 'Almuerzo', 'Lunch', 78),
  ('a1000001-0000-4000-8000-000000000001', 'Cena', 'Dinner', 79),
  ('a1000001-0000-4000-8000-000000000001', 'Azúcar', 'Sugar', 80),
  ('a1000001-0000-4000-8000-000000000001', 'Sal', 'Salt', 81),
  ('a1000001-0000-4000-8000-000000000001', 'Queso', 'Cheese', 82),
  ('a1000001-0000-4000-8000-000000000001', 'Huevo', 'Egg', 83),
  ('a1000001-0000-4000-8000-000000000001', 'Manzana', 'Apple', 84),
  ('a1000001-0000-4000-8000-000000000001', 'Naranja', 'Orange (fruit)', 85),
  ('a1000001-0000-4000-8000-000000000001', 'Plátano', 'Banana', 86),
  ('a1000001-0000-4000-8000-000000000001', 'Casa', 'House / Home', 87),
  ('a1000001-0000-4000-8000-000000000001', 'Escuela', 'School', 88),
  ('a1000001-0000-4000-8000-000000000001', 'Trabajo', 'Work', 89),
  ('a1000001-0000-4000-8000-000000000001', 'Hospital', 'Hospital', 90),
  ('a1000001-0000-4000-8000-000000000001', 'Tienda', 'Store', 91),
  ('a1000001-0000-4000-8000-000000000001', 'Restaurante', 'Restaurant', 92),
  ('a1000001-0000-4000-8000-000000000001', 'Aeropuerto', 'Airport', 93),
  ('a1000001-0000-4000-8000-000000000001', 'Hotel', 'Hotel', 94),
  ('a1000001-0000-4000-8000-000000000001', 'Playa', 'Beach', 95),
  ('a1000001-0000-4000-8000-000000000001', 'Ciudad', 'City', 96),
  ('a1000001-0000-4000-8000-000000000001', 'País', 'Country', 97),
  ('a1000001-0000-4000-8000-000000000001', 'Calle', 'Street', 98),
  ('a1000001-0000-4000-8000-000000000001', 'Mapa', 'Map', 99),
  ('a1000001-0000-4000-8000-000000000001', 'Taxi', 'Taxi', 100),
  ('a1000001-0000-4000-8000-000000000001', 'Tren', 'Train', 101),
  ('a1000001-0000-4000-8000-000000000001', 'Autobús', 'Bus', 102),
  ('a1000001-0000-4000-8000-000000000001', 'Boleto', 'Ticket', 103),
  ('a1000001-0000-4000-8000-000000000001', 'Pasaporte', 'Passport', 104),
  ('a1000001-0000-4000-8000-000000000001', 'Equipaje', 'Luggage', 105),
  ('a1000001-0000-4000-8000-000000000001', '¿Dónde está...?', 'Where is...?', 106),
  ('a1000001-0000-4000-8000-000000000001', 'Ser', 'To be (essential)', 107),
  ('a1000001-0000-4000-8000-000000000001', 'Estar', 'To be (state)', 108),
  ('a1000001-0000-4000-8000-000000000001', 'Tener', 'To have', 109),
  ('a1000001-0000-4000-8000-000000000001', 'Hacer', 'To do / make', 110),
  ('a1000001-0000-4000-8000-000000000001', 'Ir', 'To go', 111),
  ('a1000001-0000-4000-8000-000000000001', 'Venir', 'To come', 112),
  ('a1000001-0000-4000-8000-000000000001', 'Comer', 'To eat', 113),
  ('a1000001-0000-4000-8000-000000000001', 'Beber', 'To drink', 114),
  ('a1000001-0000-4000-8000-000000000001', 'Hablar', 'To speak', 115),
  ('a1000001-0000-4000-8000-000000000001', 'Escuchar', 'To listen', 116),
  ('a1000001-0000-4000-8000-000000000001', 'Ver', 'To see', 117),
  ('a1000001-0000-4000-8000-000000000001', 'Leer', 'To read', 118),
  ('a1000001-0000-4000-8000-000000000001', 'Escribir', 'To write', 119),
  ('a1000001-0000-4000-8000-000000000001', 'Aprender', 'To learn', 120),
  ('a1000001-0000-4000-8000-000000000001', 'Trabajar', 'To work', 121),
  ('a1000001-0000-4000-8000-000000000001', 'Dormir', 'To sleep', 122),
  ('a1000001-0000-4000-8000-000000000001', 'Comprar', 'To buy', 123),
  ('a1000001-0000-4000-8000-000000000001', 'Necesitar', 'To need', 124),
  ('a1000001-0000-4000-8000-000000000001', 'Querer', 'To want', 125),
  ('a1000001-0000-4000-8000-000000000001', 'Poder', 'To be able to', 126),
  ('a1000001-0000-4000-8000-000000000001', 'Hoy', 'Today', 127),
  ('a1000001-0000-4000-8000-000000000001', 'Ayer', 'Yesterday', 128),
  ('a1000001-0000-4000-8000-000000000001', 'Mañana', 'Tomorrow', 129),
  ('a1000001-0000-4000-8000-000000000001', 'Ahora', 'Now', 130),
  ('a1000001-0000-4000-8000-000000000001', 'Después', 'Later', 131),
  ('a1000001-0000-4000-8000-000000000001', 'Antes', 'Before', 132),
  ('a1000001-0000-4000-8000-000000000001', 'Siempre', 'Always', 133),
  ('a1000001-0000-4000-8000-000000000001', 'Nunca', 'Never', 134),
  ('a1000001-0000-4000-8000-000000000001', 'A veces', 'Sometimes', 135),
  ('a1000001-0000-4000-8000-000000000001', 'Temprano', 'Early', 136),
  ('a1000001-0000-4000-8000-000000000001', 'Tarde', 'Late', 137),
  ('a1000001-0000-4000-8000-000000000001', 'Hora', 'Hour / Time', 138),
  ('a1000001-0000-4000-8000-000000000001', 'Día', 'Day', 139),
  ('a1000001-0000-4000-8000-000000000001', 'Semana', 'Week', 140),
  ('a1000001-0000-4000-8000-000000000001', 'Mes', 'Month', 141),
  ('a1000001-0000-4000-8000-000000000001', 'Año', 'Year', 142),
  ('a1000001-0000-4000-8000-000000000001', 'Lunes', 'Monday', 143),
  ('a1000001-0000-4000-8000-000000000001', 'Martes', 'Tuesday', 144),
  ('a1000001-0000-4000-8000-000000000001', 'Miércoles', 'Wednesday', 145),
  ('a1000001-0000-4000-8000-000000000001', 'Jueves', 'Thursday', 146),
  ('a1000001-0000-4000-8000-000000000001', 'Viernes', 'Friday', 147),
  ('a1000001-0000-4000-8000-000000000001', 'Sábado', 'Saturday', 148),
  ('a1000001-0000-4000-8000-000000000001', 'Domingo', 'Sunday', 149),
  ('a1000001-0000-4000-8000-000000000001', 'Feliz', 'Happy', 150),
  ('a1000001-0000-4000-8000-000000000001', 'Triste', 'Sad', 151),
  ('a1000001-0000-4000-8000-000000000001', 'Cansado', 'Tired', 152),
  ('a1000001-0000-4000-8000-000000000001', 'Enojado', 'Angry', 153),
  ('a1000001-0000-4000-8000-000000000001', 'Nervioso', 'Nervous', 154),
  ('a1000001-0000-4000-8000-000000000001', 'Emocionado', 'Excited', 155),
  ('a1000001-0000-4000-8000-000000000001', 'Preocupado', 'Worried', 156),
  ('a1000001-0000-4000-8000-000000000001', 'Tranquilo', 'Calm', 157),
  ('a1000001-0000-4000-8000-000000000001', 'Aburrido', 'Bored', 158),
  ('a1000001-0000-4000-8000-000000000001', 'Sorprendido', 'Surprised', 159),
  ('a1000001-0000-4000-8000-000000000001', 'Orgulloso', 'Proud', 160),
  ('a1000001-0000-4000-8000-000000000001', 'Agradecido', 'Grateful', 161),
  ('a1000001-0000-4000-8000-000000000001', 'Solo', 'Alone / Lonely', 162),
  ('a1000001-0000-4000-8000-000000000001', 'Contento', 'Content', 163),
  ('a1000001-0000-4000-8000-000000000001', 'Asustado', 'Scared', 164),
  ('a1000001-0000-4000-8000-000000000001', 'Puerta', 'Door', 165),
  ('a1000001-0000-4000-8000-000000000001', 'Ventana', 'Window', 166),
  ('a1000001-0000-4000-8000-000000000001', 'Cama', 'Bed', 167),
  ('a1000001-0000-4000-8000-000000000001', 'Mesa', 'Table', 168),
  ('a1000001-0000-4000-8000-000000000001', 'Silla', 'Chair', 169),
  ('a1000001-0000-4000-8000-000000000001', 'Cocina', 'Kitchen', 170),
  ('a1000001-0000-4000-8000-000000000001', 'Baño', 'Bathroom', 171),
  ('a1000001-0000-4000-8000-000000000001', 'Teléfono', 'Phone', 172),
  ('a1000001-0000-4000-8000-000000000001', 'Llave', 'Key', 173),
  ('a1000001-0000-4000-8000-000000000001', 'Dinero', 'Money', 174),
  ('a1000001-0000-4000-8000-000000000001', 'Ropa', 'Clothes', 175),
  ('a1000001-0000-4000-8000-000000000001', 'Zapato', 'Shoe', 176),
  ('a1000001-0000-4000-8000-000000000001', 'Bolsa', 'Bag', 177),
  ('a1000001-0000-4000-8000-000000000001', 'Regalo', 'Gift', 178),
  ('a1000001-0000-4000-8000-000000000001', 'Fiesta', 'Party', 179)
on conflict (deck_id, sort_order) do nothing;

insert into public.flashcard_cards (deck_id, front_text, back_text, reading_text, sort_order) values
  ('a1000002-0000-4000-8000-000000000002', 'こんにちは', 'Hello', 'Konnichiwa', 0),
  ('a1000002-0000-4000-8000-000000000002', 'おはよう', 'Good morning', 'Ohayō', 1),
  ('a1000002-0000-4000-8000-000000000002', 'こんばんは', 'Good evening', 'Konbanwa', 2),
  ('a1000002-0000-4000-8000-000000000002', 'さようなら', 'Goodbye', 'Sayōnara', 3),
  ('a1000002-0000-4000-8000-000000000002', 'ありがとう', 'Thank you', 'Arigatō', 4),
  ('a1000002-0000-4000-8000-000000000002', 'すみません', 'Excuse me / Sorry', 'Sumimasen', 5),
  ('a1000002-0000-4000-8000-000000000002', 'ごめんなさい', 'I''m sorry', 'Gomen nasai', 6),
  ('a1000002-0000-4000-8000-000000000002', 'はい', 'Yes', 'Hai', 7),
  ('a1000002-0000-4000-8000-000000000002', 'いいえ', 'No', 'Iie', 8),
  ('a1000002-0000-4000-8000-000000000002', 'お元気ですか', 'How are you?', 'O-genki desu ka', 9),
  ('a1000002-0000-4000-8000-000000000002', '元気です', 'I''m fine', 'Genki desu', 10),
  ('a1000002-0000-4000-8000-000000000002', 'はじめまして', 'Nice to meet you', 'Hajimemashite', 11),
  ('a1000002-0000-4000-8000-000000000002', '愛してる', 'I love you', 'Aishiteru', 12),
  ('a1000002-0000-4000-8000-000000000002', '会いたい', 'I miss you / I want to see you', 'Aitai', 13),
  ('a1000002-0000-4000-8000-000000000002', 'おやすみ', 'Good night', 'Oyasumi', 14),
  ('a1000002-0000-4000-8000-000000000002', 'いただきます', 'Thanks for the meal (before eating)', 'Itadakimasu', 15),
  ('a1000002-0000-4000-8000-000000000002', 'ごちそうさまでした', 'Thanks for the meal (after eating)', 'Gochisōsama deshita', 16),
  ('a1000002-0000-4000-8000-000000000002', 'またね', 'See you later', 'Mata ne', 17),
  ('a1000002-0000-4000-8000-000000000002', '一', 'One', 'Ichi', 18),
  ('a1000002-0000-4000-8000-000000000002', '二', 'Two', 'Ni', 19),
  ('a1000002-0000-4000-8000-000000000002', '三', 'Three', 'San', 20),
  ('a1000002-0000-4000-8000-000000000002', '四', 'Four', 'Shi/Yon', 21),
  ('a1000002-0000-4000-8000-000000000002', '五', 'Five', 'Go', 22),
  ('a1000002-0000-4000-8000-000000000002', '六', 'Six', 'Roku', 23),
  ('a1000002-0000-4000-8000-000000000002', '七', 'Seven', 'Nana/Shichi', 24),
  ('a1000002-0000-4000-8000-000000000002', '八', 'Eight', 'Hachi', 25),
  ('a1000002-0000-4000-8000-000000000002', '九', 'Nine', 'Kyuu/Ku', 26),
  ('a1000002-0000-4000-8000-000000000002', '十', 'Ten', 'Juu', 27),
  ('a1000002-0000-4000-8000-000000000002', '二十', 'Twenty', 'Nijuu', 28),
  ('a1000002-0000-4000-8000-000000000002', '三十', 'Thirty', 'Sanjuu', 29),
  ('a1000002-0000-4000-8000-000000000002', '百', 'Hundred', 'Hyaku', 30),
  ('a1000002-0000-4000-8000-000000000002', '千', 'Thousand', 'Sen', 31),
  ('a1000002-0000-4000-8000-000000000002', '万', 'Ten thousand', 'Man', 32),
  ('a1000002-0000-4000-8000-000000000002', '赤', 'Red', 'Aka', 33),
  ('a1000002-0000-4000-8000-000000000002', '青', 'Blue', 'Ao', 34),
  ('a1000002-0000-4000-8000-000000000002', '緑', 'Green', 'Midori', 35),
  ('a1000002-0000-4000-8000-000000000002', '黄色', 'Yellow', 'Kiiro', 36),
  ('a1000002-0000-4000-8000-000000000002', '黒', 'Black', 'Kuro', 37),
  ('a1000002-0000-4000-8000-000000000002', '白', 'White', 'Shiro', 38),
  ('a1000002-0000-4000-8000-000000000002', 'ピンク', 'Pink', 'Pinku', 39),
  ('a1000002-0000-4000-8000-000000000002', '紫', 'Purple', 'Murasaki', 40),
  ('a1000002-0000-4000-8000-000000000002', 'オレンジ', 'Orange', 'Orenji', 41),
  ('a1000002-0000-4000-8000-000000000002', '灰色', 'Gray', 'Haiiro', 42),
  ('a1000002-0000-4000-8000-000000000002', '母', 'Mother', 'Haha', 43),
  ('a1000002-0000-4000-8000-000000000002', '父', 'Father', 'Chichi', 44),
  ('a1000002-0000-4000-8000-000000000002', '兄', 'Older brother', 'Ani', 45),
  ('a1000002-0000-4000-8000-000000000002', '姉', 'Older sister', 'Ane', 46),
  ('a1000002-0000-4000-8000-000000000002', '弟', 'Younger brother', 'Otouto', 47),
  ('a1000002-0000-4000-8000-000000000002', '妹', 'Younger sister', 'Imouto', 48),
  ('a1000002-0000-4000-8000-000000000002', '息子', 'Son', 'Musuko', 49),
  ('a1000002-0000-4000-8000-000000000002', '娘', 'Daughter', 'Musume', 50),
  ('a1000002-0000-4000-8000-000000000002', '祖父', 'Grandfather', 'Sofu', 51),
  ('a1000002-0000-4000-8000-000000000002', '祖母', 'Grandmother', 'Sobo', 52),
  ('a1000002-0000-4000-8000-000000000002', '夫', 'Husband', 'Otto', 53),
  ('a1000002-0000-4000-8000-000000000002', '妻', 'Wife', 'Tsuma', 54),
  ('a1000002-0000-4000-8000-000000000002', '家族', 'Family', 'Kazoku', 55),
  ('a1000002-0000-4000-8000-000000000002', '友達', 'Friend', 'Tomodachi', 56),
  ('a1000002-0000-4000-8000-000000000002', '赤ちゃん', 'Baby', 'Akachan', 57),
  ('a1000002-0000-4000-8000-000000000002', '子供', 'Child', 'Kodomo', 58),
  ('a1000002-0000-4000-8000-000000000002', '水', 'Water', 'Mizu', 59),
  ('a1000002-0000-4000-8000-000000000002', 'パン', 'Bread', 'Pan', 60),
  ('a1000002-0000-4000-8000-000000000002', '牛乳', 'Milk', 'Gyuunyuu', 61),
  ('a1000002-0000-4000-8000-000000000002', 'コーヒー', 'Coffee', 'Koohii', 62),
  ('a1000002-0000-4000-8000-000000000002', 'お茶', 'Tea', 'Ocha', 63),
  ('a1000002-0000-4000-8000-000000000002', 'ご飯', 'Rice / meal', 'Gohan', 64),
  ('a1000002-0000-4000-8000-000000000002', '鶏肉', 'Chicken', 'Toriniku', 65),
  ('a1000002-0000-4000-8000-000000000002', '魚', 'Fish', 'Sakana', 66),
  ('a1000002-0000-4000-8000-000000000002', '果物', 'Fruit', 'Kudamono', 67),
  ('a1000002-0000-4000-8000-000000000002', '野菜', 'Vegetable', 'Yasai', 68),
  ('a1000002-0000-4000-8000-000000000002', '朝ごはん', 'Breakfast', 'Asagohan', 69),
  ('a1000002-0000-4000-8000-000000000002', '昼ごはん', 'Lunch', 'Hirugohan', 70),
  ('a1000002-0000-4000-8000-000000000002', '晩ごはん', 'Dinner', 'Bangohan', 71),
  ('a1000002-0000-4000-8000-000000000002', '砂糖', 'Sugar', 'Satou', 72),
  ('a1000002-0000-4000-8000-000000000002', '塩', 'Salt', 'Shio', 73),
  ('a1000002-0000-4000-8000-000000000002', 'チーズ', 'Cheese', 'Chiizu', 74),
  ('a1000002-0000-4000-8000-000000000002', '卵', 'Egg', 'Tamago', 75),
  ('a1000002-0000-4000-8000-000000000002', 'りんご', 'Apple', 'Ringo', 76),
  ('a1000002-0000-4000-8000-000000000002', 'オレンジ', 'Orange', 'Orenji', 77),
  ('a1000002-0000-4000-8000-000000000002', 'バナナ', 'Banana', 'Banana', 78),
  ('a1000002-0000-4000-8000-000000000002', '家', 'House / Home', 'Ie', 79),
  ('a1000002-0000-4000-8000-000000000002', '学校', 'School', 'Gakkou', 80),
  ('a1000002-0000-4000-8000-000000000002', '仕事', 'Work', 'Shigoto', 81),
  ('a1000002-0000-4000-8000-000000000002', '病院', 'Hospital', 'Byouin', 82),
  ('a1000002-0000-4000-8000-000000000002', '店', 'Store', 'Mise', 83),
  ('a1000002-0000-4000-8000-000000000002', 'レストラン', 'Restaurant', 'Resutoran', 84),
  ('a1000002-0000-4000-8000-000000000002', '空港', 'Airport', 'Kuukou', 85),
  ('a1000002-0000-4000-8000-000000000002', 'ホテル', 'Hotel', 'Hoteru', 86),
  ('a1000002-0000-4000-8000-000000000002', '海', 'Sea / beach', 'Umi', 87),
  ('a1000002-0000-4000-8000-000000000002', '街', 'City / town', 'Machi', 88),
  ('a1000002-0000-4000-8000-000000000002', '国', 'Country', 'Kuni', 89),
  ('a1000002-0000-4000-8000-000000000002', '道', 'Road', 'Michi', 90),
  ('a1000002-0000-4000-8000-000000000002', '地図', 'Map', 'Chizu', 91),
  ('a1000002-0000-4000-8000-000000000002', 'タクシー', 'Taxi', 'Takushii', 92),
  ('a1000002-0000-4000-8000-000000000002', '電車', 'Train', 'Densha', 93),
  ('a1000002-0000-4000-8000-000000000002', 'バス', 'Bus', 'Basu', 94),
  ('a1000002-0000-4000-8000-000000000002', '切符', 'Ticket', 'Kippu', 95),
  ('a1000002-0000-4000-8000-000000000002', 'パスポート', 'Passport', 'Pasupooto', 96),
  ('a1000002-0000-4000-8000-000000000002', '荷物', 'Luggage', 'Nimotsu', 97),
  ('a1000002-0000-4000-8000-000000000002', 'どこですか', 'Where is it?', 'Doko desu ka', 98),
  ('a1000002-0000-4000-8000-000000000002', '食べる', 'To eat', 'Taberu', 99),
  ('a1000002-0000-4000-8000-000000000002', '飲む', 'To drink', 'Nomu', 100),
  ('a1000002-0000-4000-8000-000000000002', '行く', 'To go', 'Iku', 101),
  ('a1000002-0000-4000-8000-000000000002', '来る', 'To come', 'Kuru', 102),
  ('a1000002-0000-4000-8000-000000000002', '見る', 'To see', 'Miru', 103),
  ('a1000002-0000-4000-8000-000000000002', '聞く', 'To listen / ask', 'Kiku', 104),
  ('a1000002-0000-4000-8000-000000000002', '話す', 'To speak', 'Hanasu', 105),
  ('a1000002-0000-4000-8000-000000000002', '読む', 'To read', 'Yomu', 106),
  ('a1000002-0000-4000-8000-000000000002', '書く', 'To write', 'Kaku', 107),
  ('a1000002-0000-4000-8000-000000000002', '学ぶ', 'To learn', 'Manabu', 108),
  ('a1000002-0000-4000-8000-000000000002', '働く', 'To work', 'Hataraku', 109),
  ('a1000002-0000-4000-8000-000000000002', '寝る', 'To sleep', 'Neru', 110),
  ('a1000002-0000-4000-8000-000000000002', '買う', 'To buy', 'Kau', 111),
  ('a1000002-0000-4000-8000-000000000002', '必要', 'Necessary / need', 'Hitsuyou', 112),
  ('a1000002-0000-4000-8000-000000000002', '欲しい', 'Want', 'Hoshii', 113),
  ('a1000002-0000-4000-8000-000000000002', 'できる', 'Can do', 'Dekiru', 114),
  ('a1000002-0000-4000-8000-000000000002', 'する', 'To do', 'Suru', 115),
  ('a1000002-0000-4000-8000-000000000002', 'ある', 'To exist (things)', 'Aru', 116),
  ('a1000002-0000-4000-8000-000000000002', 'いる', 'To exist (people)', 'Iru', 117),
  ('a1000002-0000-4000-8000-000000000002', '分かる', 'To understand', 'Wakaru', 118),
  ('a1000002-0000-4000-8000-000000000002', '今日', 'Today', 'Kyou', 119),
  ('a1000002-0000-4000-8000-000000000002', '昨日', 'Yesterday', 'Kinou', 120),
  ('a1000002-0000-4000-8000-000000000002', '明日', 'Tomorrow', 'Ashita', 121),
  ('a1000002-0000-4000-8000-000000000002', '今', 'Now', 'Ima', 122),
  ('a1000002-0000-4000-8000-000000000002', '後で', 'Later', 'Ato de', 123),
  ('a1000002-0000-4000-8000-000000000002', '前', 'Before', 'Mae', 124),
  ('a1000002-0000-4000-8000-000000000002', 'いつも', 'Always', 'Itsumo', 125),
  ('a1000002-0000-4000-8000-000000000002', '決して', 'Never', 'Kesshite', 126),
  ('a1000002-0000-4000-8000-000000000002', '時々', 'Sometimes', 'Tokidoki', 127),
  ('a1000002-0000-4000-8000-000000000002', '早い', 'Early', 'Hayai', 128),
  ('a1000002-0000-4000-8000-000000000002', '遅い', 'Late', 'Osoi', 129),
  ('a1000002-0000-4000-8000-000000000002', '時間', 'Time', 'Jikan', 130),
  ('a1000002-0000-4000-8000-000000000002', '日', 'Day', 'Hi', 131),
  ('a1000002-0000-4000-8000-000000000002', '週', 'Week', 'Shuu', 132),
  ('a1000002-0000-4000-8000-000000000002', '月', 'Month', 'Tsuki', 133),
  ('a1000002-0000-4000-8000-000000000002', '年', 'Year', 'Toshi', 134),
  ('a1000002-0000-4000-8000-000000000002', '月曜日', 'Monday', 'Getsuyoubi', 135),
  ('a1000002-0000-4000-8000-000000000002', '火曜日', 'Tuesday', 'Kayoubi', 136),
  ('a1000002-0000-4000-8000-000000000002', '水曜日', 'Wednesday', 'Suiyoubi', 137),
  ('a1000002-0000-4000-8000-000000000002', '木曜日', 'Thursday', 'Mokuyoubi', 138),
  ('a1000002-0000-4000-8000-000000000002', '金曜日', 'Friday', 'Kinyoubi', 139),
  ('a1000002-0000-4000-8000-000000000002', '土曜日', 'Saturday', 'Doyoubi', 140),
  ('a1000002-0000-4000-8000-000000000002', '日曜日', 'Sunday', 'Nichiyoubi', 141),
  ('a1000002-0000-4000-8000-000000000002', '嬉しい', 'Happy', 'Ureshii', 142),
  ('a1000002-0000-4000-8000-000000000002', '悲しい', 'Sad', 'Kanashii', 143),
  ('a1000002-0000-4000-8000-000000000002', '疲れた', 'Tired', 'Tsukareta', 144),
  ('a1000002-0000-4000-8000-000000000002', '怒っている', 'Angry', 'Okotte iru', 145),
  ('a1000002-0000-4000-8000-000000000002', '緊張', 'Nervous', 'Kinchou', 146),
  ('a1000002-0000-4000-8000-000000000002', 'ワクワク', 'Excited', 'Wakuwaku', 147),
  ('a1000002-0000-4000-8000-000000000002', '心配', 'Worried', 'Shinpai', 148),
  ('a1000002-0000-4000-8000-000000000002', '落ち着いた', 'Calm', 'Ochitsuita', 149),
  ('a1000002-0000-4000-8000-000000000002', '退屈', 'Bored', 'Taikutsu', 150),
  ('a1000002-0000-4000-8000-000000000002', '驚いた', 'Surprised', 'Odoroita', 151),
  ('a1000002-0000-4000-8000-000000000002', '誇らしい', 'Proud', 'Hokorashii', 152),
  ('a1000002-0000-4000-8000-000000000002', '感謝', 'Gratitude', 'Kansha', 153),
  ('a1000002-0000-4000-8000-000000000002', '寂しい', 'Lonely', 'Sabishii', 154),
  ('a1000002-0000-4000-8000-000000000002', '満足', 'Satisfied', 'Manzoku', 155),
  ('a1000002-0000-4000-8000-000000000002', '怖い', 'Scary / scared', 'Kowai', 156),
  ('a1000002-0000-4000-8000-000000000002', 'ドア', 'Door', 'Doa', 157),
  ('a1000002-0000-4000-8000-000000000002', '窓', 'Window', 'Mado', 158),
  ('a1000002-0000-4000-8000-000000000002', 'ベッド', 'Bed', 'Beddo', 159),
  ('a1000002-0000-4000-8000-000000000002', 'テーブル', 'Table', 'Teeburu', 160),
  ('a1000002-0000-4000-8000-000000000002', '椅子', 'Chair', 'Isu', 161),
  ('a1000002-0000-4000-8000-000000000002', 'キッチン', 'Kitchen', 'Kicchin', 162),
  ('a1000002-0000-4000-8000-000000000002', 'お風呂', 'Bath', 'Ofuro', 163),
  ('a1000002-0000-4000-8000-000000000002', '電話', 'Phone', 'Denwa', 164),
  ('a1000002-0000-4000-8000-000000000002', '鍵', 'Key', 'Kagi', 165),
  ('a1000002-0000-4000-8000-000000000002', 'お金', 'Money', 'Okane', 166),
  ('a1000002-0000-4000-8000-000000000002', '服', 'Clothes', 'Fuku', 167),
  ('a1000002-0000-4000-8000-000000000002', '靴', 'Shoes', 'Kutsu', 168),
  ('a1000002-0000-4000-8000-000000000002', 'かばん', 'Bag', 'Kaban', 169),
  ('a1000002-0000-4000-8000-000000000002', 'プレゼント', 'Gift', 'Purezento', 170),
  ('a1000002-0000-4000-8000-000000000002', 'パーティー', 'Party', 'Paatii', 171),
  ('a1000002-0000-4000-8000-000000000002', '太陽', 'Sun', 'Taiyou', 172),
  ('a1000002-0000-4000-8000-000000000002', '月', 'Moon', 'Tsuki', 173),
  ('a1000002-0000-4000-8000-000000000002', '雨', 'Rain', 'Ame', 174),
  ('a1000002-0000-4000-8000-000000000002', '雪', 'Snow', 'Yuki', 175),
  ('a1000002-0000-4000-8000-000000000002', '風', 'Wind', 'Kaze', 176),
  ('a1000002-0000-4000-8000-000000000002', '暑い', 'Hot', 'Atsui', 177),
  ('a1000002-0000-4000-8000-000000000002', '寒い', 'Cold', 'Samui', 178),
  ('a1000002-0000-4000-8000-000000000002', '空', 'Sky', 'Sora', 179)
on conflict (deck_id, sort_order) do nothing;

-- per-user learning progress (mastery, starred, review count) — mirrors iOS's FlashcardProgress,
-- which treats local device state as authoritative and this table as best-effort sync.
create table if not exists public.flashcard_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  card_id uuid not null references public.flashcard_cards (id) on delete cascade,
  mastery text not null default 'new' check (mastery in ('new', 'practice', 'solid')),
  is_starred boolean not null default false,
  review_count int not null default 0,
  last_reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

create index if not exists flashcard_progress_user_idx
  on public.flashcard_progress (user_id);

alter table public.flashcard_progress enable row level security;

drop policy if exists "flashcard_progress_select_own" on public.flashcard_progress;
create policy "flashcard_progress_select_own" on public.flashcard_progress
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "flashcard_progress_insert_own" on public.flashcard_progress;
create policy "flashcard_progress_insert_own" on public.flashcard_progress
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "flashcard_progress_update_own" on public.flashcard_progress;
create policy "flashcard_progress_update_own" on public.flashcard_progress
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "flashcard_progress_delete_own" on public.flashcard_progress;
create policy "flashcard_progress_delete_own" on public.flashcard_progress
  for delete to authenticated using (user_id = auth.uid());


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

-- ============ grants ============
-- rls policies only decide which rows a role can touch — the role also needs the underlying
-- table/column grant, or postgres rejects the query before rls even runs ("permission denied
-- for table x"). this makes sure every table above is fully readable/writable by authenticated
-- (rls still does the real row-level restricting), and covers any table added later too.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;
