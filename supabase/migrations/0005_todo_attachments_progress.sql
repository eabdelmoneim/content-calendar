-- Content Calendar to-dos: attached files and "in progress".
--   asset_ids: files attached to a to-do (the finished video or image, or a
--     draft of it). Each id points at a row in cc_assets, so the file also
--     sits in the Assets library. Order is the order they were attached.
--   started_at / started_by_name: set when someone marks the to-do as in
--     progress, so the team can see what's being worked on and by whom.
-- Apply by hand in the Supabase SQL editor. Safe to run more than once.
-- Adds columns only; nothing is altered or dropped.
alter table cc_asset_todos add column if not exists asset_ids uuid[] not null default '{}';
alter table cc_asset_todos add column if not exists started_at timestamptz;
alter table cc_asset_todos add column if not exists started_by_name text;
