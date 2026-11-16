import "server-only";

import { MAX_ASSIGNEE_NAME, MAX_TODO_TITLE, type AssetTodo } from "@/lib/types";

import { db } from "./db";
import { fail } from "./http";

type TodoRow = {
  id: string;
  title: string;
  due_on: string | null;
  assignee_name: string | null;
  completed_at: string | null;
  completed_by_name: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
};

const TODO_COLUMNS = "id,title,due_on,assignee_name,completed_at,completed_by_name,created_by_name,created_at,updated_at";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function toTodo(row: TodoRow): AssetTodo {
  return {
    id: row.id,
    title: row.title,
    dueOn: row.due_on,
    assigneeName: row.assignee_name,
    completedAt: row.completed_at,
    completedByName: row.completed_by_name,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** PostgREST result → data; a missing table points at this feature's migration. */
function mustTodos<T>(
  result: { data: T | null; error: { message: string; code?: string } | null },
  what: string,
): T {
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

function isRealDay(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export async function listTodos(workspaceId: string): Promise<AssetTodo[]> {
  const rows = mustTodos(
    await db()
      .from("cc_asset_todos")
      .select(TODO_COLUMNS)
      .eq("workspace_id", workspaceId)
      .is("archived_at", null)
      .order("created_at", { ascending: true }),
    "list to-dos",
  ) as TodoRow[];
  return rows.map(toTodo);
}

export async function createTodo(
  workspaceId: string,
  input: { title?: unknown; dueOn?: unknown; assigneeName?: unknown },
  userName: string,
): Promise<AssetTodo> {
  const row = mustTodos(
    await db()
      .from("cc_asset_todos")
      .insert({
        workspace_id: workspaceId,
        title: cleanTitle(input.title),
        due_on: cleanDueOn(input.dueOn),
        assignee_name: cleanAssignee(input.assigneeName),
        created_by_name: userName,
        updated_by_name: userName,
      })
      .select(TODO_COLUMNS)
      .single(),
    "add to-do",
  ) as TodoRow;
  return toTodo(row);
}

/** Any of title, due date, assignee and done; fields left out stay as they are. */
export async function updateTodo(
  workspaceId: string,
  id: string,
  input: { title?: unknown; dueOn?: unknown; assigneeName?: unknown; done?: unknown },
  userName: string,
): Promise<AssetTodo> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by_name: userName };
  if ("title" in input) patch.title = cleanTitle(input.title);
  if ("dueOn" in input) patch.due_on = cleanDueOn(input.dueOn);
  if ("assigneeName" in input) patch.assignee_name = cleanAssignee(input.assigneeName);
  if ("done" in input) {
    if (typeof input.done !== "boolean") fail(400, "bad_done", "done must be true or false.");
    patch.completed_at = input.done ? new Date().toISOString() : null;
    patch.completed_by_name = input.done ? userName : null;
  }
  const rows = mustTodos(
    await db()
      .from("cc_asset_todos")
      .update(patch)
      .eq("workspace_id", workspaceId)
      .eq("id", id)
      .is("archived_at", null)
      .select(TODO_COLUMNS),
    "update to-do",
  ) as TodoRow[];
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
