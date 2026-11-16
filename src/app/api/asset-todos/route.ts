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

/** JSON { title, dueOn?, assigneeName? }. */
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const body = await readJson<{ title?: unknown; dueOn?: unknown; assigneeName?: unknown }>(request);
    const { workspace, user } = await currentSession();
    return { todo: await createTodo(workspace.id, body ?? {}, user.name) };
  });
}
