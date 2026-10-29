-- STEP 0: Read-only. Run this first in Supabase SQL Editor.
-- If this lists any Music Star table, do NOT run 01 on top of it.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('profiles', 'teachers', 'teacher_rates', 'students', 'lessons', 'invoices')
order by table_name;
