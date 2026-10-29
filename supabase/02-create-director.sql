-- STEP 2: FIRST create your sign-in account in Authentication > Users > Add user.
-- Replace the email and name below, then run this file in SQL Editor.
-- This does not create a password or Auth user; it links an existing Auth account.
begin;
do $$
declare
  director_email text := 'REPLACE_WITH_YOUR_EMAIL';
  director_name text := 'REPLACE_WITH_YOUR_NAME';
  account_id uuid;
begin
  if director_email = 'REPLACE_WITH_YOUR_EMAIL' or director_name = 'REPLACE_WITH_YOUR_NAME' then
    raise exception 'Replace the director email and name before running this query';
  end if;
  select id into account_id from auth.users where lower(email) = lower(director_email);
  if account_id is null then
    raise exception 'Create this account in Authentication > Users first: %', director_email;
  end if;
  insert into public.profiles (id, full_name, role, active)
    values (account_id, director_name, 'director', true)
    on conflict (id) do update set full_name = excluded.full_name, role = 'director', active = true;
end;
$$;
commit;

select p.id, p.full_name, p.role, p.active
from public.profiles p where p.role = 'director';
