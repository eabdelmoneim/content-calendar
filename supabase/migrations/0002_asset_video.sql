-- Content Calendar: let the Assets library hold video (MP4, MOV, WebM).
-- Safe to run more than once. Only touches cc_assets' mime_type check.
-- The cc-assets storage bucket's types and 50 MB limit are set through the
-- Storage API, not SQL.
alter table cc_assets drop constraint if exists cc_assets_mime_type_check;
alter table cc_assets add constraint cc_assets_mime_type_check check (
  mime_type in (
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm'
  )
);
