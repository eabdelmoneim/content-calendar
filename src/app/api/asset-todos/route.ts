import { handle, readJson } from "@/server/http";
import { currentSession, currentWorkspace } from "@/server/session";
import { createTodo, listTodos } from "@/server/todos";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return handle(async () => {
    const workspace = await currentWorkspace();
    return { todos: await listTodos(workspace.id) };
  });
}

/** JSON { title, dueOn?, assigneeNames?, assigneeName?, assetIds? }. */
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const body = await readJson<{
      title?: unknown;
      dueOn?: unknown;
      assigneeNames?: unknown;
      /** One name; kept for older callers. */
      assigneeName?: unknown;
      assetIds?: unknown;
    }>(request);
    const { workspace, user } = await currentSession();
    return { todo: await createTodo(workspace.id, body ?? {}, user.name) };
  });
}
