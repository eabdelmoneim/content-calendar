"use client";

import { useSession } from "@/lib/api";

/**
 * Peacock's workspace access, backed by the Nebula session. Nebula already
 * gates who can open the miniapp, so there is one workspace and no admin.
 */
export type WorkspaceAccess = {
  isAdmin: boolean;
  workspaces: readonly { orgId: string; name: string }[];
  selectWorkspace: (orgId: string) => void;
};

export type WorkspaceActor = {
  orgId: string;
  organizationName: string;
  name: string;
  avatarUrl: string | null;
};

export function useWorkspaceAccess(): WorkspaceAccess | null {
  const session = useSession();
  if (!session.data) return null;
  return {
    isAdmin: false,
    workspaces: [{ orgId: session.data.workspace.id, name: session.data.workspace.name }],
    selectWorkspace: () => {},
  };
}

export function useWorkspaceActor(): WorkspaceActor {
  const session = useSession();
  return {
    orgId: session.data?.workspace.id ?? "",
    organizationName: session.data?.workspace.name ?? "Workspace",
    name: session.data?.user.name ?? "Loading…",
    avatarUrl: session.data?.user.avatarUrl ?? null,
  };
}
