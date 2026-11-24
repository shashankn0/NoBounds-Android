-- NoBounds Test Check-in: paste into Supabase SQL Editor and Run once.

create table roster (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  sort_order int
);

create table checkins (
  id uuid primary key default gen_random_uuid(),
  roster_id uuid not null references roster(id) on delete cascade,
  check_date date not null,
  created_at timestamptz default now(),
  unique (roster_id, check_date)
);

alter table roster enable row level security;
alter table checkins enable row level security;

create policy "anon read roster" on roster for select to anon using (true);
create policy "anon read checkins" on checkins for select to anon using (true);
-- Only today's New York date can be inserted: no backdating or future-dating.
create policy "anon insert today" on checkins for insert to anon
  with check (check_date = (now() at time zone 'America/New_York')::date);

-- No update/delete policies, so RLS blocks those for anon (verified: DELETE matches 0 rows).
grant select on roster, checkins to anon;
grant insert on checkins to anon;

insert into roster (email, sort_order) values
  ('m101patel@gmail.com', 1),
  ('shaan101patel@gmail.com', 2),
  ('sahilhanda101@gmail.com', 3),
  ('binita101@gmail.com', 4),
  ('mspatel101@yahoo.com', 5),
  ('snellutla26@gmail.com', 6),
  ('cmnell@gmail.com', 7),
  ('suginjupalli@gmail.com', 8),
  ('srinikethchakilam@gmail.com', 9),
  ('kevinlobo327@gmail.com', 10),
  ('shanknellutla@gmail.com', 11),
  ('shashankphotos12321@gmail.com', 12),
  ('sujathagc2023@gmail.com', 13);
