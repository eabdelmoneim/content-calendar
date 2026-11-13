import "server-only";

import { callNebulaApi } from "@/lib/nebula-proxy";
import type { Session } from "@/lib/types";

type NebulaMe = {
  user_id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  icon_url: string | null;
};

type NebulaWorkspace = { id: string; name: string; icon_url: string | null };

export type Workspace = Session["workspace"];
export type User = Session["user"];

/*
 * The workspace this miniapp lives in never changes for the life of the
 * process, so it is read once and kept (an id and a name, not a credential).
 * Every table row is scoped to it.
 */
let workspacePromise: Promise<Workspace> | null = null;

export function currentWorkspace(): Promise<Workspace> {
  if (!workspacePromise) {
    workspacePromise = callNebulaApi<NebulaWorkspace>({ path: "workspace" })
      .then((workspace) => ({ id: workspace.id, name: workspace.name, iconUrl: workspace.icon_url }))
      .catch((error: unknown) => {
        workspacePromise = null;
        throw error;
      });
  }
  return workspacePromise;
}

/** The visitor making this request (x-nebula-caller), read per request. */
export async function currentUser(): Promise<User> {
  const me = await callNebulaApi<NebulaMe>({ path: "me" });
  const fullName = [me.first_name, me.last_name].filter(Boolean).join(" ");
  return { id: me.user_id, name: fullName.length > 0 ? fullName : me.username, avatarUrl: me.icon_url };
}

export async function currentSession(): Promise<Session> {
  const [workspace, user] = await Promise.all([currentWorkspace(), currentUser()]);
  return { workspace, user };
}
