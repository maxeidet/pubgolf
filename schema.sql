-- Pubgolf – komplett schema
-- Kör i Supabase → SQL Editor. Kan köras flera gånger: befintliga tabeller,
-- spelare och poäng behålls, och barerna uppdateras till listan nedan.

-- Tabeller --------------------------------------------------------------

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists holes (
  game_id uuid references games(id) on delete cascade,
  number int not null,
  bar text not null,
  par int not null,
  primary key (game_id, number)
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists scores (
  player_id uuid references players(id) on delete cascade,
  hole_number int not null,
  sips int not null check (sips >= 0),
  updated_at timestamptz default now(),
  primary key (player_id, hole_number)
);

-- Kvällens spel och barer (enligt det tryckta scorekortet) ---------------

insert into games (name)
select 'Pubgolf 7 nov'
where not exists (select 1 from games where active);

with g as (
  select id from games where active order by created_at desc limit 1
)
insert into holes (game_id, number, bar, par)
select g.id, h.number, h.bar, h.par
from g, (values
  (1, 'Pitchers',        2),
  (2, 'Ågatanbar',       2),
  (3, 'Ölhaket',         3),
  (4, 'Ölstugan',        3),
  (5, 'Shotluckan',      1),
  (6, 'Salladsbaren',    2),
  (7, 'Överste Mörner',  3),
  (8, 'Borgmästaren',    3),
  (9, 'Horse and Hound', 4)
) as h(number, bar, par)
on conflict (game_id, number) do update
  set bar = excluded.bar, par = excluded.par;

-- Åtkomst för anon-nyckeln ----------------------------------------------
-- Alla får läsa. Att gå med och spara poäng sker bara via funktionerna
-- join_game och set_score nedan, som kontrollerar PIN-koden.

alter table games   enable row level security;
alter table holes   enable row level security;
alter table players enable row level security;
alter table scores  enable row level security;

drop policy if exists "read"   on games;
drop policy if exists "read"   on holes;
drop policy if exists "read"   on players;
drop policy if exists "join"   on players;
drop policy if exists "read"   on scores;
drop policy if exists "write"  on scores;
drop policy if exists "update" on scores;
drop policy if exists "delete" on scores;

create policy "read" on games   for select using (true);
create policy "read" on holes   for select using (true);
create policy "read" on players for select using (true);
create policy "read" on scores  for select using (true);

-- PIN per spelare --------------------------------------------------------
-- Hemlig tabell: RLS på men inga policies, så ingen kan läsa den via API:t.

create extension if not exists pgcrypto with schema extensions;

create table if not exists player_secrets (
  player_id uuid primary key references players(id) on delete cascade,
  pin_hash text not null,
  token uuid not null default gen_random_uuid()
);
alter table player_secrets enable row level security;

-- Gå med eller logga in. Nytt namn: skapar spelaren med PIN:en.
-- Befintligt namn: PIN:en måste stämma (den som först loggar in på ett
-- namn utan PIN sätter den). Returnerar spelar-id och en sessionsnyckel.
create or replace function join_game(p_name text, p_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  g uuid;
  pid uuid;
  s player_secrets;
begin
  p_name := btrim(coalesce(p_name, ''));
  if p_name = '' or length(p_name) > 30 then
    raise exception 'Skriv ett namn (max 30 tecken).';
  end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' then
    raise exception 'PIN-koden ska vara 4 siffror.';
  end if;

  select id into g from games where active order by created_at desc limit 1;
  if g is null then
    raise exception 'Inget aktivt spel hittades.';
  end if;

  select id into pid from players
  where game_id = g and lower(name) = lower(p_name)
  order by created_at limit 1;
  if pid is null then
    insert into players (game_id, name) values (g, p_name) returning id into pid;
  end if;

  select * into s from player_secrets where player_secrets.player_id = pid;
  if not found then
    insert into player_secrets (player_id, pin_hash)
    values (pid, crypt(p_pin, gen_salt('bf')))
    returning * into s;
  elsif s.pin_hash <> crypt(p_pin, s.pin_hash) then
    raise exception 'Fel PIN-kod för %.', p_name;
  end if;

  return json_build_object('player_id', pid, 'token', s.token);
end $$;

-- Spara eller rensa (p_sips = null) ett hål. Kräver spelarens sessionsnyckel.
create or replace function set_score(p_player uuid, p_token uuid, p_hole int, p_sips int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from player_secrets where player_id = p_player and token = p_token
  ) then
    raise exception 'Inte inloggad' using errcode = '28000';
  end if;
  if p_hole not between 1 and 99 then
    raise exception 'Ogiltigt hål.';
  end if;

  if p_sips is null then
    delete from scores where player_id = p_player and hole_number = p_hole;
  else
    if p_sips not between 0 and 99 then
      raise exception 'Ogiltigt antal klunkar.';
    end if;
    insert into scores (player_id, hole_number, sips, updated_at)
    values (p_player, p_hole, p_sips, now())
    on conflict (player_id, hole_number)
      do update set sips = excluded.sips, updated_at = now();
  end if;
end $$;

revoke all on function join_game(text, text) from public;
revoke all on function set_score(uuid, uuid, int, int) from public;
grant execute on function join_game(text, text) to anon, authenticated;
grant execute on function set_score(uuid, uuid, int, int) to anon, authenticated;

-- Live-uppdatering för topplistan ---------------------------------------

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'scores') then
    alter publication supabase_realtime add table scores;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'players') then
    alter publication supabase_realtime add table players;
  end if;
end $$;
