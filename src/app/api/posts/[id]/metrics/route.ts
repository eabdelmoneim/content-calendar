import { handle, readJson } from "@/server/http";
import { recordMetrics, validateMetricsInput, type MetricsInput } from "@/server/repo";
import { currentSession } from "@/server/session";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context): Promise<Response> {
  return handle(async () => {
    const { id } = await params;
    const metrics = validateMetricsInput(await readJson<Partial<MetricsInput>>(request));
    const { workspace, user } = await currentSession();
    return { post: await recordMetrics(workspace.id, user, id, metrics) };
  });
}
