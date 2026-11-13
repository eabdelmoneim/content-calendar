-- Content Calendar: let a post carry links to large media kept elsewhere
-- (YouTube or Google Drive), alongside or instead of uploaded assets.
-- Apply by hand in the Supabase SQL editor. Safe to run more than once.
-- The app validates each link's host; the database caps how many.
alter table cc_posts add column if not exists media_links text[] not null default '{}';
alter table cc_posts drop constraint if exists cc_posts_media_links_count;
alter table cc_posts add constraint cc_posts_media_links_count check (cardinality(media_links) <= 5);
