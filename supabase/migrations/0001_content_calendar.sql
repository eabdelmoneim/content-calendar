-- Content Calendar miniapp: posts, assets and analytics for X + LinkedIn.
--
-- Lives in the SAME hosted Supabase project as nebula-web (blueprint_*, webinar_*,
-- use_case, waitlist, ...). Every object here is prefixed `cc_` so it cannot
-- collide with nebula-web tables. Nothing in this file alters or drops an
-- existing table.
--
-- RLS is enabled with NO policies (the nebula-web convention): only the
-- miniapp's server routes, which use SUPABASE_SECRET_KEY, can read or write.
--
-- Apply by hand in the Supabase SQL editor. Idempotent: safe to re-run.

create extension if not exists pgcrypto;

-- People and brands whose accounts post. One profile carries both its
-- LinkedIn and X identity, like Peacock's "profiles".
create table if not exists cc_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  name text not null check (length(trim(name)) > 0),
  kind text not null default 'person' check (kind in ('person', 'company')),
  avatar_url text,
  linkedin_url text,
  x_handle text,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cc_profiles_workspace_idx on cc_profiles (workspace_id) where archived_at is null;

create table if not exists cc_posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  profile_id uuid not null references cc_profiles (id) on delete restrict,
  platform text not null check (platform in ('linkedin', 'x')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  content_html text not null default '',
  content_text text not null default '',
  scheduled_at timestamptz,
  -- A person approved this exact text for posting (required before "Post now").
  approved_at timestamptz,
  approved_by_name text,
  published_at timestamptz,
  published_url text,
  created_by_user_id text,
  created_by_name text,
  updated_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cc_posts_scheduled_has_time check (status <> 'scheduled' or scheduled_at is not null),
  constraint cc_posts_published_has_time check (status <> 'published' or published_at is not null)
);
create index if not exists cc_posts_calendar_idx on cc_posts (workspace_id, coalesce(published_at, scheduled_at));
create index if not exists cc_posts_profile_idx on cc_posts (profile_id);

create table if not exists cc_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/gif', 'image/webp')),
  size_bytes bigint not null check (size_bytes > 0),
  width integer,
  height integer,
  created_by_name text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists cc_assets_workspace_idx on cc_assets (workspace_id, created_at desc) where archived_at is null;

create table if not exists cc_post_assets (
  post_id uuid not null references cc_posts (id) on delete cascade,
  asset_id uuid not null references cc_assets (id) on delete restrict,
  position integer not null check (position >= 0 and position < 20),
  primary key (post_id, asset_id),
  unique (post_id, position)
);
create index if not exists cc_post_assets_asset_idx on cc_post_assets (asset_id);

-- Point-in-time metrics for a published post. Latest row per post wins.
create table if not exists cc_post_metrics (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references cc_posts (id) on delete cascade,
  captured_at timestamptz not null default now(),
  impressions integer check (impressions >= 0),
  reactions integer check (reactions >= 0),
  comments integer check (comments >= 0),
  reposts integer check (reposts >= 0),
  clicks integer check (clicks >= 0),
  source text not null check (source in ('manual', 'csv', 'x_api', 'linkedin_api')),
  entered_by_name text
);
create index if not exists cc_post_metrics_post_idx on cc_post_metrics (post_id, captured_at desc);

-- Follower counts over time, per profile and platform.
create table if not exists cc_follower_snapshots (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references cc_profiles (id) on delete cascade,
  platform text not null check (platform in ('linkedin', 'x')),
  captured_on date not null,
  followers integer not null check (followers >= 0),
  source text not null check (source in ('manual', 'csv', 'x_api', 'linkedin_api')),
  unique (profile_id, platform, captured_on)
);

alter table cc_profiles enable row level security;
alter table cc_posts enable row level security;
alter table cc_assets enable row level security;
alter table cc_post_assets enable row level security;
alter table cc_post_metrics enable row level security;
alter table cc_follower_snapshots enable row level security;
