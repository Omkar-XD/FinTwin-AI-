-- Update documents.status workflow for upload-then-analyze.
--
-- The original public.documents table and documents_status_check constraint
-- are not defined in this repository (likely created directly in Supabase).
-- The legacy constraint allowed the old queue-based flow, e.g.:
--   queued, processing, completed, failed
--
-- New allowed statuses:
--   uploaded, analyzing, processing, completed, failed

begin;

-- Normalize legacy rows before replacing the constraint.
update public.documents
set status = 'uploaded'
where status is null
   or status in ('queued', 'pending');

update public.documents
set status = 'uploaded'
where status not in ('uploaded', 'analyzing', 'processing', 'completed', 'failed');

alter table public.documents
  drop constraint if exists documents_status_check;

alter table public.documents
  add constraint documents_status_check
  check (status in ('uploaded', 'analyzing', 'processing', 'completed', 'failed'));

alter table public.documents
  alter column status set default 'uploaded';

commit;
