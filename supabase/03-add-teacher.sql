-- STEP 3: Optional. Create ONE teacher account in Authentication > Users first.
-- Replace the values below. Repeat for each actual teacher (do not use demo contacts).
begin;
do $$
declare
  teacher_email text := 'REPLACE_WITH_TEACHER_EMAIL';
  teacher_name text := 'REPLACE_WITH_TEACHER_NAME';
  teacher_instrument text := 'Piano'; -- Piano, Violin, Cello, or Flute
  teacher_hourly_rate numeric := 45.00;
  rate_start date := (now() at time zone 'Pacific/Auckland')::date;
  account_id uuid;
  teacher_record_id uuid;
begin
  if teacher_email = 'REPLACE_WITH_TEACHER_EMAIL' or teacher_name = 'REPLACE_WITH_TEACHER_NAME' then
    raise exception 'Replace the teacher email and name before running this query';
  end if;
  select id into account_id from auth.users where lower(email) = lower(teacher_email);
  if account_id is null then raise exception 'Create this teacher in Authentication > Users first'; end if;
  if exists (select 1 from public.profiles where id = account_id and role = 'director') then
    raise exception 'Use a separate account for the teacher; this account is a director';
  end if;
  insert into public.profiles (id, full_name, role)
    values (account_id, teacher_name, 'teacher')
    on conflict (id) do update set full_name = excluded.full_name;
  insert into public.teachers (user_id, name, instrument, email)
    values (account_id, teacher_name, teacher_instrument, teacher_email)
    on conflict (user_id) do update set name = excluded.name,
      instrument = excluded.instrument, email = excluded.email
    returning id into teacher_record_id;
  insert into public.teacher_rates (teacher_id, hourly_rate, effective_from)
    values (teacher_record_id, teacher_hourly_rate, rate_start)
    on conflict (teacher_id, effective_from) do update set hourly_rate = excluded.hourly_rate;
end;
$$;
commit;

select id, name, instrument, user_id from public.teachers order by name;
