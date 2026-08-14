-- NoBounds-Android rough prototype schema
-- Paste this whole file into your Supabase project's SQL Editor and run it once.
-- Trimmed subset of the iOS app's phase-1 schema — only what the Core (real) features need:
-- Auth/profiles, pairing, daily prompts, timeline memories.

-- ============ profiles ============
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Someone',
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

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

create policy "couples_select_member" on public.couples
  for select using (public.is_couple_member(id));

create policy "couple_members_select_own_couple" on public.couple_members
  for select using (public.is_couple_member(couple_id));

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

  return new_couple_id;
end;
$$;

-- ============ daily prompts ============
create table if not exists public.prompt_templates (
  id uuid primary key default gen_random_uuid(),
  text text not null
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
on conflict do nothing;

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

create policy "couple_daily_prompts_member" on public.couple_daily_prompts
  for select using (public.is_couple_member(couple_id));
create policy "couple_daily_prompts_insert_member" on public.couple_daily_prompts
  for insert with check (public.is_couple_member(couple_id));

create policy "prompt_answers_select_couple" on public.prompt_answers
  for select using (
    exists (
      select 1 from public.couple_daily_prompts cdp
      where cdp.id = couple_daily_prompt_id and public.is_couple_member(cdp.couple_id)
    )
  );
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

alter table public.memories enable row level security;

create policy "memories_select_couple" on public.memories
  for select using (public.is_couple_member(couple_id));
create policy "memories_insert_couple" on public.memories
  for insert with check (public.is_couple_member(couple_id) and author_id = auth.uid());

-- ============ storage (memory photos) ============
insert into storage.buckets (id, name, public)
values ('memories', 'memories', true)
on conflict (id) do nothing;

create policy "memories_bucket_read" on storage.objects
  for select using (bucket_id = 'memories');
create policy "memories_bucket_insert_authenticated" on storage.objects
  for insert with check (bucket_id = 'memories' and auth.role() = 'authenticated');
