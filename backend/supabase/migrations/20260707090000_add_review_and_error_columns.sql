alter table public.documents
  add column if not exists error_message text;

alter table public.financial_profiles
  add column if not exists priority_review boolean not null default false;

alter table public.recommendations
  add column if not exists status text not null default 'approved';

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
