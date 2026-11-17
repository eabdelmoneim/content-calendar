import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AssetsPage } from "@/features/assets/assets-page";
import { ROUTES } from "@/shared/peacock/shell/nav";

export const metadata: Metadata = { title: "Assets" };

export default async function AssetsRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  // To-Do used to be a tab here; keep old `/assets?tab=todo` links working.
  if ((await searchParams).tab === "todo") redirect(ROUTES.todo);
  return (
    <Suspense fallback={null}>
      <AssetsPage />
    </Suspense>
  );
}
