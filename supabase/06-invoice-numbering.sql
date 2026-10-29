-- NEXT STEP: Run this entire file once in the Supabase SQL Editor.
-- Replaces long UUID invoice numbers with sequential INV-001-style numbers.
-- Safe to rerun: existing invoice numbers are regenerated in creation order.
begin;

create sequence if not exists public.invoice_number_seq;
grant usage, select on sequence public.invoice_number_seq to authenticated;

-- Move existing values out of the unique constraint before assigning numbers.
update public.invoices
set invoice_number = 'MIGRATED-' || id::text;

with numbered as (
  select id, row_number() over (order by created_at, id) as number
  from public.invoices
)
update public.invoices as invoices
set invoice_number = 'INV-' || lpad(numbered.number::text, 3, '0')
from numbered
where invoices.id = numbered.id;

select setval(
  'public.invoice_number_seq',
  coalesce((select count(*) from public.invoices), 1),
  (select count(*) > 0 from public.invoices)
);

alter table public.invoices
  alter column invoice_number
  set default ('INV-' || lpad(nextval('public.invoice_number_seq')::text, 3, '0'));

commit;
