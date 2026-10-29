-- STEP 1: Fresh-project setup. Run this ENTIRE file as one SQL Editor query.
-- Not a migration for existing Music Star tables. Do not run it twice.
-- Everything, including security, is committed together or rolled back together.
begin;
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
set local search_path = public, extensions;

-- Private helpers are not exposed as browser RPC endpoints.
create schema if not exists music_star_private;
revoke all on schema music_star_private from public, anon, authenticated;
grant usage on schema music_star_private to authenticated;
create sequence public.invoice_number_seq;
grant usage, select on sequence public.invoice_number_seq to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 150),
  role text not null default 'teacher' check (role in ('director', 'teacher')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 150),
  instrument text not null check (instrument in ('Piano', 'Violin', 'Cello', 'Flute')),
  email text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Keep salary information separate: teachers cannot read this table.
-- Effective dates preserve historical rates when salaries change.
create table public.teacher_rates (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  hourly_rate numeric(10,2) not null check (hourly_rate >= 0),
  effective_from date not null,
  created_at timestamptz not null default now(),
  unique (teacher_id, effective_from)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 150),
  parent_name text not null check (length(trim(parent_name)) between 1 and 150),
  parent_email text not null,
  level text not null default 'Beginner',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, teacher_id)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  teacher_id uuid not null,
  lesson_date date not null,
  start_time time without time zone not null,
  duration_minutes integer not null default 45
    check (duration_minutes between 15 and 240 and duration_minutes % 5 = 0),
  room text not null check (length(trim(room)) between 1 and 100),
  status text not null default 'Scheduled'
    check (status in ('Scheduled', 'Completed', 'Cancelled')),
  series_id uuid,
  created_at timestamptz not null default now(),
  -- Local school time, Pacific/Auckland. A weekly recurrence retains its wall-clock time.
  lesson_slot tsrange generated always as (
    tsrange(lesson_date + start_time,
      lesson_date + start_time + make_interval(mins => duration_minutes), '[)')
  ) stored,
  constraint lessons_student_teacher_fk foreign key (student_id, teacher_id)
    references public.students(id, teacher_id) on delete cascade,
  constraint lessons_finish_same_day check (
    extract(epoch from start_time) + duration_minutes * 60 <= 86400
  ),
  constraint lessons_whole_minutes check (extract(second from start_time) = 0),
  constraint lessons_teacher_no_overlap exclude using gist
    (teacher_id with =, lesson_slot with &&) where (status <> 'Cancelled'),
  constraint lessons_student_no_overlap exclude using gist
    (student_id with =, lesson_slot with &&) where (status <> 'Cancelled'),
  constraint lessons_room_no_overlap exclude using gist
    ((lower(trim(room))) with =, lesson_slot with &&) where (status <> 'Cancelled')
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique
    default ('INV-' || lpad(nextval('public.invoice_number_seq')::text, 3, '0')),
  student_id uuid references public.students(id) on delete set null,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  -- Snapshots keep issued invoices readable after contact changes or student deletion.
  student_name text not null,
  parent_name text not null,
  parent_email text not null,
  description text not null check (length(trim(description)) > 0),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'NZD' check (currency = 'NZD'),
  issued_date date not null default ((now() at time zone 'Pacific/Auckland')::date),
  due_date date not null,
  status text not null default 'Pending' check (status in ('Pending', 'Paid')),
  created_at timestamptz not null default now()
);

create index students_teacher_idx on public.students(teacher_id);
create index lessons_student_teacher_idx on public.lessons(student_id, teacher_id);
create index lessons_date_idx on public.lessons(lesson_date);
create index lessons_series_idx on public.lessons(series_id) where series_id is not null;
create index invoices_teacher_idx on public.invoices(teacher_id);
create index invoices_student_idx on public.invoices(student_id);

create function music_star_private.is_director()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles
    where id = (select auth.uid()) and role = 'director' and active);
$$;

create function music_star_private.owns_teacher(target_teacher uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.teachers t join public.profiles p on p.id = t.user_id
    where t.id = target_teacher and t.user_id = (select auth.uid())
      and t.active and p.active and p.role = 'teacher'
  );
$$;
revoke all on function music_star_private.is_director() from public, anon, authenticated;
revoke all on function music_star_private.owns_teacher(uuid) from public, anon, authenticated;
grant execute on function music_star_private.is_director() to authenticated;
grant execute on function music_star_private.owns_teacher(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.teachers enable row level security;
alter table public.teacher_rates enable row level security;
alter table public.students enable row level security;
alter table public.lessons enable row level security;
alter table public.invoices enable row level security;

-- Explicit grants plus RLS: signed-out visitors have no access.
revoke all on public.profiles, public.teachers, public.teacher_rates,
  public.students, public.lessons, public.invoices from public, anon, authenticated;
grant select, insert, update, delete on public.profiles, public.teachers,
  public.teacher_rates, public.students, public.lessons, public.invoices to authenticated;

create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or music_star_private.is_director());
-- Only directors may create/edit roles or activate/deactivate profiles.
create policy profiles_director_manage on public.profiles for all to authenticated
  using (music_star_private.is_director()) with check (music_star_private.is_director());

create policy teachers_read on public.teachers for select to authenticated
  using (music_star_private.is_director() or music_star_private.owns_teacher(id));
create policy teachers_director_manage on public.teachers for all to authenticated
  using (music_star_private.is_director()) with check (music_star_private.is_director());

create policy rates_director_only on public.teacher_rates for all to authenticated
  using (music_star_private.is_director()) with check (music_star_private.is_director());

create policy students_manage on public.students for all to authenticated
  using (music_star_private.is_director() or music_star_private.owns_teacher(teacher_id))
  with check (music_star_private.is_director() or music_star_private.owns_teacher(teacher_id));

create policy lessons_manage on public.lessons for all to authenticated
  using (music_star_private.is_director() or music_star_private.owns_teacher(teacher_id))
  with check (music_star_private.is_director() or music_star_private.owns_teacher(teacher_id));

create policy invoices_manage on public.invoices for all to authenticated
  using (music_star_private.is_director() or music_star_private.owns_teacher(teacher_id))
  with check (music_star_private.is_director() or music_star_private.owns_teacher(teacher_id));

-- On creation take contacts from the assigned student, rather than trusting client snapshots.
-- Also stop a teacher from linking an invoice to another teacher's student.
create function music_star_private.invoice_student_snapshot()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare pupil public.students%rowtype;
begin
  if new.student_id is not null then
    select * into pupil from public.students
      where id = new.student_id and teacher_id = new.teacher_id;
    if not found then raise exception 'Student does not belong to this teacher or is not accessible'; end if;
    if TG_OP = 'INSERT' then
      new.student_name := pupil.name;
      new.parent_name := pupil.parent_name;
      new.parent_email := pupil.parent_email;
    end if;
  elsif TG_OP = 'INSERT' then
    raise exception 'A student is required when creating an invoice';
  end if;
  return new;
end;
$$;
revoke all on function music_star_private.invoice_student_snapshot() from public, anon, authenticated;
create trigger invoices_snapshot before insert or update on public.invoices
  for each row execute function music_star_private.invoice_student_snapshot();

-- All recurring lessons succeed together, or none are saved on a conflict.
-- SECURITY INVOKER means the caller's normal table permissions/RLS still apply.
create function public.create_weekly_lessons(
  p_student_id uuid, p_first_date date, p_start_time time without time zone,
  p_duration_minutes integer, p_room text, p_count integer
) returns setof public.lessons language plpgsql security invoker set search_path = ''
as $$
declare assigned_teacher uuid; new_series uuid := gen_random_uuid();
begin
  if p_count is null or p_count < 2 or p_count > 52 then
    raise exception 'Choose between 2 and 52 weekly lessons';
  end if;
  select teacher_id into assigned_teacher from public.students
    where id = p_student_id and active;
  if not found then raise exception 'Student is inactive or not accessible'; end if;
  return query
    insert into public.lessons
      (student_id, teacher_id, lesson_date, start_time, duration_minutes, room, series_id)
    select p_student_id, assigned_teacher, p_first_date + (week_number * 7),
      p_start_time, p_duration_minutes, p_room, new_series
    from generate_series(0, p_count - 1) as weeks(week_number)
    returning *;
end;
$$;
revoke all on function public.create_weekly_lessons(uuid, date, time without time zone, integer, text, integer)
  from public, anon, authenticated;
grant execute on function public.create_weekly_lessons(uuid, date, time without time zone, integer, text, integer)
  to authenticated;
commit;
