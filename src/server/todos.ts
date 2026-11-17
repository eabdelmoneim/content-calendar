import "server-only";

import { MAX_ASSIGNEE_NAME, MAX_TODO_ATTACHMENTS, MAX_TODO_TITLE, type AssetTodo } from "@/lib/types";

import { db } from "./db";
import { fail } from "./http";

type TodoRow = {
  id: string;
  title: string;
  due_on: string | null;
  assignee_name: string | null;
  /** These three are missing until 0005_todo_attachments_progress.sql has run. */
  asset_ids?: string[] | null;
  started_at?: string | null;
  started_by_name?: string | null;
  completed_at: string | null;
  completed_by_name: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

const BASE_COLUMNS = "id,title,due_on,assignee_name,completed_at,completed_by_name,created_by_name,created_at,updated_at";
/** Added by migration 0005; they arrive together. */
const LATER_COLUMNS = ["asset_ids", "started_at", "started_by_name"] as const;
const TODO_COLUMNS = `${BASE_COLUMNS},${LATER_COLUMNS.join(",")}`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LATER_COLUMNS_MISSING =
  "Attachments and \"In progress\" aren't set up in Supabase yet. Apply supabase/migrations/0005_todo_attachments_progress.sql.";

type PgResult<T> = { data: T | null; error: { message: string; code?: string } | null };

/** Postgres or PostgREST "no such column": migration 0005 hasn't run. */
function missingLaterColumn(result: PgResult<unknown>): boolean {
  const error = result.error;
  return (
    (error?.code === "42703" || error?.code === "PGRST204") &&
    LATER_COLUMNS.some((column) => error.message.includes(column))
  );
}

/**
 * Runs a to-do query that returns rows. Before 0005 has run, its columns are
 * missing; reads then fall back to the older columns so the list keeps
 * working, with no attachments and nothing in progress.
 */
async function withTodoColumns<T>(run: (columns: string) => PromiseLike<PgResult<T>>, what: string): Promise<T> {
  const result = await run(TODO_COLUMNS);
  if (missingLaterColumn(result)) return mustTodos(await run(BASE_COLUMNS), what);
  return mustTodos(result, what);
}
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function toTodo(row: TodoRow): AssetTodo {
  return {
    id: row.id,
    title: row.title,
    dueOn: row.due_on,
    assigneeName: row.assignee_name,
    assetIds: row.asset_ids ?? [],
    startedAt: row.started_at ?? null,
    startedByName: row.started_by_name ?? null,
    completedAt: row.completed_at,
    completedByName: row.completed_by_name,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** PostgREST result → data; a missing table points at this feature's migration. */
function mustTodos<T>(
  result: PgResult<T>,
  what: string,
): T {
  if (missingLaterColumn(result)) fail(503, "todo_columns_missing", LATER_COLUMNS_MISSING);
  if (result.error) {
    if (result.error.code === "42P01" || result.error.code === "PGRST205") {
      fail(
        503,
        "todos_table_missing",
        "The to-do list isn't set up in Supabase yet. Apply supabase/migrations/0004_asset_todos.sql.",
      );
    }
    throw new Error(`${what}: ${result.error.message}`);
  }
  if (result.data === null) throw new Error(`${what}: no data returned`);
  return result.data;
}

function cleanTitle(value: unknown): string {
  const title = typeof value === "string" ? value.trim() : "";
  if (title.length === 0) fail(400, "title_required", "Say what you plan to make.");
  if (title.length > MAX_TODO_TITLE) fail(400, "title_too_long", `Keep it under ${MAX_TODO_TITLE} characters.`);
  return title;
}

function cleanDueOn(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const valid =
    typeof value === "string" &&
    DAY.test(value) &&
    // Round-trips only for real days (rejects 2026-02-30).
    isRealDay(value);
  if (!valid) {
    fail(400, "bad_due_date", "The due date must be a calendar day (YYYY-MM-DD).");
  }
  return value;
}

function cleanAssignee(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") fail(400, "bad_assignee", "The assignee must be a name.");
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length === 0) return null;
  if (name.length > MAX_ASSIGNEE_NAME) fail(400, "assignee_too_long", "That name is too long.");
  return name;
}

/** A list of library asset ids that exist in this workspace and aren't deleted. */
async function cleanAssetIds(workspaceId: string, value: unknown): Promise<string[]> {
  if (!Array.isArray(value) || !value.every((id): id is string => typeof id === "string" && UUID.test(id))) {
    fail(400, "bad_asset_ids", "Attachments must be a list of asset ids.");
  }
  const ids = [...new Set(value)];
  if (ids.length > MAX_TODO_ATTACHMENTS) {
    fail(400, "too_many_attachments", `A to-do can hold up to ${MAX_TODO_ATTACHMENTS} files.`);
  }
  if (ids.length === 0) return ids;
  const rows = mustTodos(
    await db().from("cc_assets").select("id").eq("workspace_id", workspaceId).is("archived_at", null).in("id", ids),
    "check attachments",
  ) as { id: string }[];
  if (rows.length !== ids.length) {
    fail(400, "asset_not_found", "One of the attached files was deleted from Assets. Remove it and try again.");
  }
  return ids;
}

function isRealDay(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export async function listTodos(workspaceId: string): Promise<AssetTodo[]> {
  const rows = (await withTodoColumns(
    (columns) =>
      db()
        .from("cc_asset_todos")
        .select(columns)
        .eq("workspace_id", workspaceId)
        .is("archived_at", null)
        .order("created_at", { ascending: true }),
    "list to-dos",
  )) as unknown as TodoRow[];
  return rows.map(toTodo);
}

export async function createTodo(
  workspaceId: string,
  input: { title?: unknown; dueOn?: unknown; assigneeName?: unknown; assetIds?: unknown },
  userName: string,
): Promise<AssetTodo> {
  const fields: Record<string, unknown> = {
    workspace_id: workspaceId,
    title: cleanTitle(input.title),
    due_on: cleanDueOn(input.dueOn),
    assignee_name: cleanAssignee(input.assigneeName),
    created_by_name: userName,
    updated_by_name: userName,
  };
  const assetIds = input.assetIds === undefined ? [] : await cleanAssetIds(workspaceId, input.assetIds);
  // Only name the column when there is something to store, so plain to-dos
  // still save before the attachments migration has run.
  if (assetIds.length > 0) fields.asset_ids = assetIds;
  const row = mustTodos(
    await db().from("cc_asset_todos").insert(fields).select(assetIds.length > 0 ? TODO_COLUMNS : BASE_COLUMNS).single(),
    "add to-do",
  ) as unknown as TodoRow;
  return toTodo(row);
}

/** Any of title, due date, assignee, attachments, in progress and done; fields left out stay as they are. */
export async function updateTodo(
  workspaceId: string,
  id: string,
  input: { title?: unknown; dueOn?: unknown; assigneeName?: unknown; assetIds?: unknown; inProgress?: unknown; done?: unknown },
  userName: string,
): Promise<AssetTodo> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by_name: userName };
  if ("title" in input) patch.title = cleanTitle(input.title);
  if ("dueOn" in input) patch.due_on = cleanDueOn(input.dueOn);
  if ("assigneeName" in input) patch.assignee_name = cleanAssignee(input.assigneeName);
  if ("assetIds" in input) patch.asset_ids = await cleanAssetIds(workspaceId, input.assetIds);
  if ("inProgress" in input) {
    if (typeof input.inProgress !== "boolean") fail(400, "bad_in_progress", "inProgress must be true or false.");
    patch.started_at = input.inProgress ? new Date().toISOString() : null;
    patch.started_by_name = input.inProgress ? userName : null;
  }
  if ("done" in input) {
    if (typeof input.done !== "boolean") fail(400, "bad_done", "done must be true or false.");
    patch.completed_at = input.done ? new Date().toISOString() : null;
    patch.completed_by_name = input.done ? userName : null;
  }
  const query = (columns: string) =>
    db()
      .from("cc_asset_todos")
      .update(patch)
      .eq("workspace_id", workspaceId)
      .eq("id", id)
      .is("archived_at", null)
      .select(columns);
  // Writing a 0005 column needs it to exist; other edits work either way.
  const rows = (LATER_COLUMNS.some((column) => column in patch)
    ? mustTodos(await query(TODO_COLUMNS), "update to-do")
    : await withTodoColumns(query, "update to-do")) as unknown as TodoRow[];
  if (rows.length === 0) fail(404, "todo_not_found", "That to-do no longer exists.");
  return toTodo(rows[0]);
}

/** Hide an item from the list. The row is kept (archived), never deleted. */
export async function archiveTodo(workspaceId: string, id: string, userName: string): Promise<void> {
  const now = new Date().toISOString();
  const rows = mustTodos(
    await db()
      .from("cc_asset_todos")
      .update({ archived_at: now, updated_at: now, updated_by_name: userName })
      .eq("workspace_id", workspaceId)
      .eq("id", id)
      .is("archived_at", null)
      .select("id"),
    "remove to-do",
  ) as { id: string }[];
  if (rows.length === 0) fail(404, "todo_not_found", "That to-do no longer exists.");
}
