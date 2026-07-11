-- Refresh documents.status CHECK constraint for upload-then-analyze workflow.
--
-- Context:
-- - public.documents and documents_status_check are not created in this repo.
-- - Legacy allowed values were typically: queued, processing, completed, failed
-- - New allowed values: uploaded, analyzing, processing, completed, failed
--
-- Safe to run in Supabase SQL Editor or via: supabase db push

begin;

-- Preserve existing rows by normalizing legacy statuses before constraint replacement.
update public.documents
set status = 'uploaded'
where status is null
   or status in ('queued', 'pending');

update public.documents
set status = 'uploaded'
where status not in ('uploaded', 'analyzing', 'processing', 'completed', 'failed');

-- Drop the old CHECK constraint if present.
alter table public.documents
  drop constraint if exists documents_status_check;

-- Recreate with the new workflow statuses.
alter table public.documents
  add constraint documents_status_check
  check (status in ('uploaded', 'analyzing', 'processing', 'completed', 'failed'));

alter table public.documents
  alter column status set default 'uploaded';

commit;
