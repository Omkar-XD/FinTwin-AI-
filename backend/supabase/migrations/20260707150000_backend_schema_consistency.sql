-- FinTwin backend schema consistency migration.
-- Safe to run multiple times in Supabase SQL Editor.

begin;

-- ---------------------------------------------------------------------------
-- documents: upload-then-analyze workflow statuses
-- ---------------------------------------------------------------------------
update public.documents
set status = 'uploaded'
where status is null
   or status in ('queued', 'pending');

update public.documents
set status = 'uploaded'
where status not in ('uploaded', 'analyzing', 'processing', 'completed', 'failed');

alter table public.documents
  add column if not exists error_message text;

alter table public.documents
  drop constraint if exists documents_status_check;

alter table public.documents
  add constraint documents_status_check
  check (status in ('uploaded', 'analyzing', 'processing', 'completed', 'failed'));

alter table public.documents
  alter column status set default 'uploaded';

-- ---------------------------------------------------------------------------
-- chat_history: tools_used for assistant audit trail
-- ---------------------------------------------------------------------------
alter table public.chat_history
  add column if not exists tools_used jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- financial_profiles: priority review flag for critical risk path
-- ---------------------------------------------------------------------------
alter table public.financial_profiles
  add column if not exists priority_review boolean not null default false;

-- ---------------------------------------------------------------------------
-- recommendations: review workflow status
-- ---------------------------------------------------------------------------
alter table public.recommendations
  add column if not exists status text;

update public.recommendations
set status = 'approved'
where status is null;

alter table public.recommendations
  alter column status set default 'approved';

alter table public.recommendations
  alter column status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'recommendations_status_check'
      and conrelid = 'public.recommendations'::regclass
  ) then
    alter table public.recommendations
      add constraint recommendations_status_check
      check (status in ('approved', 'pending_review', 'rejected'));
  end if;
end $$;

create index if not exists recommendations_user_status_created_at_idx
  on public.recommendations (user_id, status, created_at desc);

commit;
