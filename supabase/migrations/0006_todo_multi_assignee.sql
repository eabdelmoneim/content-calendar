-- Content Calendar: a to-do can be on more than one person.
-- Apply by hand in the Supabase SQL editor. Safe to run more than once.
-- Nothing here drops a column: assignee_name stays and holds the names as JSON
-- until this runs, then the app keeps it in step with the list below.

alter table cc_asset_todos add column if not exists assignee_names text[];

-- Move the names already on the list across. A single name was stored as one
-- name; several were stored as a JSON array.
update cc_asset_todos
set assignee_names = case
  when assignee_name is null then null
  when left(trim(assignee_name), 1) = '[' then (
    select array_agg(value)
    from json_array_elements_text(trim(assignee_name)::json) as value
  )
  else array[trim(assignee_name)]
end
where assignee_names is null;
