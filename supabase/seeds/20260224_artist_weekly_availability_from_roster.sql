-- Seed base weekly artist availability from your exported roster snapshot.
-- This inserts recurring weekly working hours (not breaks / exceptions).
-- It upserts by (artist_id, day_of_week), so it's safe to rerun.

-- Assumes studio name = 'Victims of Ink'
-- day_of_week uses PostgreSQL convention: 0=Sun, 1=Mon, ... 6=Sat

with studio_target as (
  select id as studio_id
  from public.studios
  where name = 'Victims of Ink'
  limit 1
),
input_rows as (
  select * from (
    values
      -- Brian Ledda (Tue-Fri 11-6)
      ('Brian Ledda', 2, '11:00:00'::time, '18:00:00'::time),
      ('Brian Ledda', 3, '11:00:00'::time, '18:00:00'::time),
      ('Brian Ledda', 4, '11:00:00'::time, '18:00:00'::time),
      ('Brian Ledda', 5, '11:00:00'::time, '18:00:00'::time),

      -- Chanelle Pititto (Tue-Sat 11-8)
      ('Chanelle Pititto', 2, '11:00:00'::time, '20:00:00'::time),
      ('Chanelle Pititto', 3, '11:00:00'::time, '20:00:00'::time),
      ('Chanelle Pititto', 4, '11:00:00'::time, '20:00:00'::time),
      ('Chanelle Pititto', 5, '11:00:00'::time, '20:00:00'::time),
      ('Chanelle Pititto', 6, '11:00:00'::time, '20:00:00'::time),

      -- Cody Guest (Tue, Sat 11-6)
      ('Cody Guest', 2, '11:00:00'::time, '18:00:00'::time),
      ('Cody Guest', 6, '11:00:00'::time, '18:00:00'::time),

      -- David Carry (Mon-Sat 11-8)
      ('David Carry', 1, '11:00:00'::time, '20:00:00'::time),
      ('David Carry', 2, '11:00:00'::time, '20:00:00'::time),
      ('David Carry', 3, '11:00:00'::time, '20:00:00'::time),
      ('David Carry', 4, '11:00:00'::time, '20:00:00'::time),
      ('David Carry', 5, '11:00:00'::time, '20:00:00'::time),
      ('David Carry', 6, '11:00:00'::time, '20:00:00'::time),

      -- Digby Stewart (Tue-Sat 11-7)
      ('Digby Stewart', 2, '11:00:00'::time, '19:00:00'::time),
      ('Digby Stewart', 3, '11:00:00'::time, '19:00:00'::time),
      ('Digby Stewart', 4, '11:00:00'::time, '19:00:00'::time),
      ('Digby Stewart', 5, '11:00:00'::time, '19:00:00'::time),
      ('Digby Stewart', 6, '11:00:00'::time, '19:00:00'::time),

      -- Enrico Bigi (Tue-Sat 11-8)
      ('Enrico Bigi', 2, '11:00:00'::time, '20:00:00'::time),
      ('Enrico Bigi', 3, '11:00:00'::time, '20:00:00'::time),
      ('Enrico Bigi', 4, '11:00:00'::time, '20:00:00'::time),
      ('Enrico Bigi', 5, '11:00:00'::time, '20:00:00'::time),
      ('Enrico Bigi', 6, '11:00:00'::time, '20:00:00'::time),

      -- Hayley Bayley (Tue-Sat 11-6)
      ('Hayley Bayley', 2, '11:00:00'::time, '18:00:00'::time),
      ('Hayley Bayley', 3, '11:00:00'::time, '18:00:00'::time),
      ('Hayley Bayley', 4, '11:00:00'::time, '18:00:00'::time),
      ('Hayley Bayley', 5, '11:00:00'::time, '18:00:00'::time),
      ('Hayley Bayley', 6, '11:00:00'::time, '18:00:00'::time),

      -- Juff Tattoo (Tue-Sat 11-6)
      ('Juff Tattoo', 2, '11:00:00'::time, '18:00:00'::time),
      ('Juff Tattoo', 3, '11:00:00'::time, '18:00:00'::time),
      ('Juff Tattoo', 4, '11:00:00'::time, '18:00:00'::time),
      ('Juff Tattoo', 5, '11:00:00'::time, '18:00:00'::time),
      ('Juff Tattoo', 6, '11:00:00'::time, '18:00:00'::time),

      -- Lucas Marques (Mon-Fri, Sun 11-8)
      ('Lucas Marques', 0, '11:00:00'::time, '20:00:00'::time),
      ('Lucas Marques', 1, '11:00:00'::time, '20:00:00'::time),
      ('Lucas Marques', 2, '11:00:00'::time, '20:00:00'::time),
      ('Lucas Marques', 3, '11:00:00'::time, '20:00:00'::time),
      ('Lucas Marques', 4, '11:00:00'::time, '20:00:00'::time),
      ('Lucas Marques', 5, '11:00:00'::time, '20:00:00'::time),

      -- Milli Bug (Tue-Sat 11-8)
      ('Milli Bug', 2, '11:00:00'::time, '20:00:00'::time),
      ('Milli Bug', 3, '11:00:00'::time, '20:00:00'::time),
      ('Milli Bug', 4, '11:00:00'::time, '20:00:00'::time),
      ('Milli Bug', 5, '11:00:00'::time, '20:00:00'::time),
      ('Milli Bug', 6, '11:00:00'::time, '20:00:00'::time),

      -- Niki Peppers (Mon, Wed-Sat 2-6)
      ('Niki Peppers', 1, '14:00:00'::time, '18:00:00'::time),
      ('Niki Peppers', 3, '14:00:00'::time, '18:00:00'::time),
      ('Niki Peppers', 4, '14:00:00'::time, '18:00:00'::time),
      ('Niki Peppers', 5, '14:00:00'::time, '18:00:00'::time),
      ('Niki Peppers', 6, '14:00:00'::time, '18:00:00'::time),

      -- Oli John (Mon 11-8, Wed-Thu 3-8, Fri-Sat 11-8)
      ('Oli John', 1, '11:00:00'::time, '20:00:00'::time),
      ('Oli John', 3, '15:00:00'::time, '20:00:00'::time),
      ('Oli John', 4, '15:00:00'::time, '20:00:00'::time),
      ('Oli John', 5, '11:00:00'::time, '20:00:00'::time),
      ('Oli John', 6, '11:00:00'::time, '20:00:00'::time),

      -- Pau Costa (Mon-Sat 11-6)
      ('Pau Costa', 1, '11:00:00'::time, '18:00:00'::time),
      ('Pau Costa', 2, '11:00:00'::time, '18:00:00'::time),
      ('Pau Costa', 3, '11:00:00'::time, '18:00:00'::time),
      ('Pau Costa', 4, '11:00:00'::time, '18:00:00'::time),
      ('Pau Costa', 5, '11:00:00'::time, '18:00:00'::time),
      ('Pau Costa', 6, '11:00:00'::time, '18:00:00'::time),

      -- Rafael Couto (Mon-Sat 11-6, Sun 11-8)
      ('Rafael Couto', 0, '11:00:00'::time, '20:00:00'::time),
      ('Rafael Couto', 1, '11:00:00'::time, '18:00:00'::time),
      ('Rafael Couto', 2, '11:00:00'::time, '18:00:00'::time),
      ('Rafael Couto', 3, '11:00:00'::time, '18:00:00'::time),
      ('Rafael Couto', 4, '11:00:00'::time, '18:00:00'::time),
      ('Rafael Couto', 5, '11:00:00'::time, '18:00:00'::time),
      ('Rafael Couto', 6, '11:00:00'::time, '18:00:00'::time),

      -- Syd Richmond (Tue-Sat 11-6)
      ('Syd Richmond', 2, '11:00:00'::time, '18:00:00'::time),
      ('Syd Richmond', 3, '11:00:00'::time, '18:00:00'::time),
      ('Syd Richmond', 4, '11:00:00'::time, '18:00:00'::time),
      ('Syd Richmond', 5, '11:00:00'::time, '18:00:00'::time),
      ('Syd Richmond', 6, '11:00:00'::time, '18:00:00'::time),

      -- Tanya Putthapipat (Mon, Wed-Sat 11-8)
      ('Tanya Putthapipat', 1, '11:00:00'::time, '20:00:00'::time),
      ('Tanya Putthapipat', 3, '11:00:00'::time, '20:00:00'::time),
      ('Tanya Putthapipat', 4, '11:00:00'::time, '20:00:00'::time),
      ('Tanya Putthapipat', 5, '11:00:00'::time, '20:00:00'::time),
      ('Tanya Putthapipat', 6, '11:00:00'::time, '20:00:00'::time),

      -- Tobias Meredith (Mon-Sat 10-7)
      ('Tobias Meredith', 1, '10:00:00'::time, '19:00:00'::time),
      ('Tobias Meredith', 2, '10:00:00'::time, '19:00:00'::time),
      ('Tobias Meredith', 3, '10:00:00'::time, '19:00:00'::time),
      ('Tobias Meredith', 4, '10:00:00'::time, '19:00:00'::time),
      ('Tobias Meredith', 5, '10:00:00'::time, '19:00:00'::time),
      ('Tobias Meredith', 6, '10:00:00'::time, '19:00:00'::time),

      -- Tom Rattle (Tue-Sat 11-8)
      ('Tom Rattle', 2, '11:00:00'::time, '20:00:00'::time),
      ('Tom Rattle', 3, '11:00:00'::time, '20:00:00'::time),
      ('Tom Rattle', 4, '11:00:00'::time, '20:00:00'::time),
      ('Tom Rattle', 5, '11:00:00'::time, '20:00:00'::time),
      ('Tom Rattle', 6, '11:00:00'::time, '20:00:00'::time),

      -- Will Halstead-Smith (Mon-Wed, Sun 12-8)
      ('Will Halstead-Smith', 0, '12:00:00'::time, '20:00:00'::time),
      ('Will Halstead-Smith', 1, '12:00:00'::time, '20:00:00'::time),
      ('Will Halstead-Smith', 2, '12:00:00'::time, '20:00:00'::time),
      ('Will Halstead-Smith', 3, '12:00:00'::time, '20:00:00'::time),

      -- Woody Tattoo (Mon-Sat 11-6)
      ('Woody Tattoo', 1, '11:00:00'::time, '18:00:00'::time),
      ('Woody Tattoo', 2, '11:00:00'::time, '18:00:00'::time),
      ('Woody Tattoo', 3, '11:00:00'::time, '18:00:00'::time),
      ('Woody Tattoo', 4, '11:00:00'::time, '18:00:00'::time),
      ('Woody Tattoo', 5, '11:00:00'::time, '18:00:00'::time),
      ('Woody Tattoo', 6, '11:00:00'::time, '18:00:00'::time),

      -- Yesid Correa (Tue-Fri 11-8)
      ('Yesid Correa', 2, '11:00:00'::time, '20:00:00'::time),
      ('Yesid Correa', 3, '11:00:00'::time, '20:00:00'::time),
      ('Yesid Correa', 4, '11:00:00'::time, '20:00:00'::time),
      ('Yesid Correa', 5, '11:00:00'::time, '20:00:00'::time),

      -- Yuli Prajapati (Tue-Sat 11-8)
      ('Yuli Prajapati', 2, '11:00:00'::time, '20:00:00'::time),
      ('Yuli Prajapati', 3, '11:00:00'::time, '20:00:00'::time),
      ('Yuli Prajapati', 4, '11:00:00'::time, '20:00:00'::time),
      ('Yuli Prajapati', 5, '11:00:00'::time, '20:00:00'::time),
      ('Yuli Prajapati', 6, '11:00:00'::time, '20:00:00'::time)
  ) as v(roster_artist_name, day_of_week, start_local_time, end_local_time)
),
artist_aliases as (
  -- Handles display-name differences between your roster export and app artist names.
  select * from (
    values
      ('Juff Tattoo', 'Juff'),
      ('Woody Tattoo', 'Woody')
  ) as a(roster_artist_name, app_artist_name)
),
normalized_artists as (
  select
    a.id as artist_id,
    a.studio_id,
    a.display_name,
    regexp_replace(lower(a.display_name), '[^a-z0-9]+', '', 'g') as artist_key
  from public.artists a
  join studio_target s on s.studio_id = a.studio_id
),
resolved_rows as (
  select
    i.roster_artist_name,
    coalesce(alias.app_artist_name, i.roster_artist_name) as app_artist_name,
    i.day_of_week,
    i.start_local_time,
    i.end_local_time
  from input_rows i
  left join artist_aliases alias on alias.roster_artist_name = i.roster_artist_name
),
matched as (
  select
    na.studio_id,
    na.artist_id,
    r.day_of_week,
    r.start_local_time,
    r.end_local_time
  from resolved_rows r
  join normalized_artists na
    on na.artist_key = regexp_replace(lower(r.app_artist_name), '[^a-z0-9]+', '', 'g')
),
upserted as (
  insert into public.artist_weekly_availability (
    studio_id,
    artist_id,
    day_of_week,
    start_local_time,
    end_local_time,
    timezone,
    active
  )
  select
    studio_id,
    artist_id,
    day_of_week,
    start_local_time,
    end_local_time,
    'Australia/Melbourne',
    true
  from matched
  on conflict (artist_id, day_of_week)
  do update set
    start_local_time = excluded.start_local_time,
    end_local_time = excluded.end_local_time,
    timezone = excluded.timezone,
    active = true
  returning artist_id
)
select count(*) as rows_upserted from upserted;

-- Optional: See any roster names that did not match an artist in the app.
with input_names as (
  select distinct roster_artist_name from (
    values
      ('Brian Ledda'), ('Chanelle Pititto'), ('Cody Guest'), ('David Carry'),
      ('Digby Stewart'), ('Enrico Bigi'), ('Hayley Bayley'), ('Juff Tattoo'),
      ('Lucas Marques'), ('Milli Bug'), ('Niki Peppers'), ('Oli John'),
      ('Pau Costa'), ('Rafael Couto'), ('Syd Richmond'), ('Tanya Putthapipat'),
      ('Tobias Meredith'), ('Tom Rattle'), ('Will Halstead-Smith'),
      ('Woody Tattoo'), ('Yesid Correa'), ('Yuli Prajapati')
  ) as x(roster_artist_name)
),
artist_aliases as (
  select * from (
    values ('Juff Tattoo', 'Juff'), ('Woody Tattoo', 'Woody')
  ) as a(roster_artist_name, app_artist_name)
),
studio_target as (
  select id as studio_id from public.studios where name = 'Victims of Ink' limit 1
),
app_keys as (
  select regexp_replace(lower(display_name), '[^a-z0-9]+', '', 'g') as k
  from public.artists a
  join studio_target s on s.studio_id = a.studio_id
)
select
  i.roster_artist_name as unmatched_roster_name
from input_names i
left join artist_aliases aa on aa.roster_artist_name = i.roster_artist_name
where regexp_replace(lower(coalesce(aa.app_artist_name, i.roster_artist_name)), '[^a-z0-9]+', '', 'g')
  not in (select k from app_keys)
order by 1;

