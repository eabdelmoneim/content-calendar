import { fail, handle, readJson } from "@/server/http";
import { currentSession } from "@/server/session";
import { archiveTodo, updateTodo } from "@/server/todos";

type Context = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function todoId(params: Context["params"]): Promise<string> {
  const { id } = await params;
  if (!UUID.test(id)) fail(404, "todo_not_found", "That to-do no longer exists.");
  return id;
}

/** JSON with any of { title, dueOn, assigneeNames, assigneeName, assetIds, inProgress, done }. */
export async function PATCH(request: Request, { params }: Context): Promise<Response> {
  return handle(async () => {
    const id = await todoId(params);
    const body = await readJson<{
      title?: unknown;
      dueOn?: unknown;
      assigneeNames?: unknown;
      /** One name; kept for older callers. */
      assigneeName?: unknown;
      assetIds?: unknown;
      inProgress?: unknown;
      done?: unknown;
    }>(request);
    const { workspace, user } = await currentSession();
    return { todo: await updateTodo(workspace.id, id, body ?? {}, user.name) };
  });
}

/** Removes the item from the list (archived; the row is kept). */
export async function DELETE(_request: Request, { params }: Context): Promise<Response> {
  return handle(async () => {
    const id = await todoId(params);
    const { workspace, user } = await currentSession();
    await archiveTodo(workspace.id, id, user.name);
    return { ok: true };
  });
}
