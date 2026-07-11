alter table public.chat_history
  add column if not exists tools_used jsonb not null default '[]'::jsonb;
