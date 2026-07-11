create table if not exists validation_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  agent text not null,
  validation_mode text not null,
  event_type text not null,
  response_id text not null,
  duration_ms integer,
  adherence_score numeric,
  safety_score numeric,
  passed_safety boolean not null,
  passed_factual boolean not null,
  issues jsonb,
  warnings jsonb,
  response_preview text,
  created_at timestamptz default now()
);

create index if not exists validation_logs_user_id_created_at_idx
  on validation_logs (user_id, created_at desc);

create index if not exists validation_logs_response_id_idx
  on validation_logs (response_id);
