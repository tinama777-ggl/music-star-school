-- NEXT STEP: Run this entire file once in Supabase SQL Editor.
-- Adds an atomic director-only save for a teacher and an effective-dated hourly rate.
-- Safe to rerun: it replaces this function without changing existing records.
begin;
create or replace function public.save_teacher(
  p_id uuid,
  p_name text,
  p_instrument text,
  p_email text,
  p_rate numeric,
  p_effective_from date,
  p_user_id uuid default null
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare saved_id uuid;
begin
  if not music_star_private.is_director() then
    raise exception 'Only the director can manage teachers' using errcode = '42501';
  end if;
  if p_rate is null or p_rate < 0 or p_rate > 10000 or p_effective_from is null then
    raise exception 'Choose a valid rate and effective date' using errcode = '23514';
  end if;
  if p_user_id is not null and not exists (
    select 1 from public.profiles where id = p_user_id and role = 'teacher' and active
  ) then
    raise exception 'Select an active teacher sign-in profile' using errcode = '23514';
  end if;
  if p_id is null then
    insert into public.teachers (name, instrument, email, user_id)
      values (p_name, p_instrument, p_email, p_user_id) returning id into saved_id;
  else
    update public.teachers set name = p_name, instrument = p_instrument,
      email = p_email, user_id = p_user_id where id = p_id returning id into saved_id;
    if saved_id is null then raise exception 'Teacher not found'; end if;
  end if;
  insert into public.teacher_rates (teacher_id, hourly_rate, effective_from)
    values (saved_id, p_rate, p_effective_from)
    on conflict (teacher_id, effective_from) do update set hourly_rate = excluded.hourly_rate;
  return saved_id;
end;
$$;
revoke all on function public.save_teacher(uuid,text,text,text,numeric,date,uuid)
  from public, anon, authenticated;
grant execute on function public.save_teacher(uuid,text,text,text,numeric,date,uuid)
  to authenticated;
commit;
