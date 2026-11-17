-- Content Calendar: a shared to-do list under Assets for media the team plans
-- to make. Each item has free text, an optional due date, the person it is
-- assigned to and a done state.
-- Apply by hand in the Supabase SQL editor. Safe to run more than once.
-- Nothing here alters or drops an existing table. "Remove" in the app sets
-- archived_at; rows are never deleted.
create table if not exists cc_asset_todos (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  title text not null check (length(trim(title)) between 1 and 500),
  due_on date,
  assignee_name text check (assignee_name is null or length(trim(assignee_name)) between 1 and 120),
  completed_at timestamptz,
  completed_by_name text,
  created_by_name text,
  updated_by_name text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cc_asset_todos_workspace_idx
  on cc_asset_todos (workspace_id, created_at) where archived_at is null;

-- For databases that ran an earlier copy of this file without assignees.
alter table cc_asset_todos add column if not exists assignee_name text;

alter table cc_asset_todos enable row level security;
