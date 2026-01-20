-- Create locked-down SQL executor for the importer
-- Only allows CREATE TABLE, CREATE INDEX, ALTER TABLE, and INSERT INTO
create or replace function public.onet_exec(stmt text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s text;
begin
  if stmt is null or length(trim(stmt)) = 0 then
    raise exception 'Empty SQL statement';
  end if;

  s := trim(stmt);
  if right(s, 1) = ';' then
    s := left(s, length(s) - 1);
    s := trim(s);
  end if;

  -- hard deny list
  if s ~* '\m(drop|truncate|delete|update|grant|revoke|create\s+role|alter\s+role|create\s+extension|alter\s+system|vacuum|analyze|copy)\M' then
    raise exception 'Statement contains forbidden operation';
  end if;

  -- forbid touching reserved schemas
  if s ~* '\m(auth|storage|realtime|supabase_functions|vault)\.' then
    raise exception 'Statement references forbidden schema';
  end if;

  -- allow only create table / create index / alter table / insert into
  if not (
    s ~* '^create\s+table\s+' or
    s ~* '^create\s+(unique\s+)?index\s+' or
    s ~* '^alter\s+table\s+' or
    s ~* '^insert\s+into\s+'
  ) then
    raise exception 'Only CREATE TABLE/INDEX, ALTER TABLE, and INSERT are allowed';
  end if;

  execute s;
end;
$$;

-- lock it down: only the service role can call it
revoke all on function public.onet_exec(text) from public;
revoke all on function public.onet_exec(text) from anon;
revoke all on function public.onet_exec(text) from authenticated;
grant execute on function public.onet_exec(text) to service_role;