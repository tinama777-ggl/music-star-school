-- STEP 4: Read-only checks. Run each SELECT separately to see each result.
-- Expect six tables, all with row_security_enabled = true.
select tablename, rowsecurity as row_security_enabled
from pg_tables where schemaname = 'public'
  and tablename in ('profiles','teachers','teacher_rates','students','lessons','invoices')
order by tablename;

-- Expect named access policies on all six tables.
select tablename, policyname, cmd, roles from pg_policies
where schemaname = 'public'
  and tablename in ('profiles','teachers','teacher_rates','students','lessons','invoices')
order by tablename, policyname;

-- All anonymous table-access booleans must be false.
select name as table_name,
  has_table_privilege('anon', 'public.' || name, 'SELECT') as anonymous_read,
  has_table_privilege('anon', 'public.' || name, 'INSERT') as anonymous_insert,
  has_table_privilege('anon', 'public.' || name, 'UPDATE') as anonymous_update,
  has_table_privilege('anon', 'public.' || name, 'DELETE') as anonymous_delete
from unnest(array['profiles','teachers','teacher_rates','students','lessons','invoices']) as t(name);

-- The first account should be director; other accounts should be teacher.
select full_name, role, active from public.profiles order by created_at;

-- Expect three exclusion constraints and a student/teacher foreign key.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid = 'public.lessons'::regclass
order by conname;

-- SQL Editor runs with elevated access. These checks inspect configuration;
-- they do NOT replace API tests signed in as director and two separate teachers.
