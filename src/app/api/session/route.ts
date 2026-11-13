import { handle } from "@/server/http";
import { currentSession } from "@/server/session";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return handle(() => currentSession());
}
