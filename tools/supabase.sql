-- Online backup for the Lernkiste progress. Run once in the SQL editor of the
-- private Supabase project. The table is closed (RLS on, no policies); the app
-- only reaches it through two functions that need the device's secret code.

create table if not exists public.lernstand (
  code      text primary key check (char_length(code) between 16 and 40),
  daten     jsonb not null,
  geaendert timestamptz not null default now()
);
alter table public.lernstand enable row level security;
revoke all on table public.lernstand from anon, authenticated;

create or replace function public.lernstand_speichern(p_code text, p_daten jsonb)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare t timestamptz := now();
begin
  if char_length(p_code) < 16 or char_length(p_code) > 40 or pg_column_size(p_daten) > 1000000 then
    raise exception 'ungültige Sicherung';
  end if;
  insert into public.lernstand (code, daten, geaendert) values (p_code, p_daten, t)
  on conflict (code) do update set daten = excluded.daten, geaendert = t;
  return t;
end $$;

create or replace function public.lernstand_laden(p_code text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('daten', daten, 'geaendert', geaendert)
  from public.lernstand where code = p_code;
$$;

revoke all on function public.lernstand_speichern(text, jsonb) from public;
revoke all on function public.lernstand_laden(text) from public;
grant execute on function public.lernstand_speichern(text, jsonb) to anon;
grant execute on function public.lernstand_laden(text) to anon;
