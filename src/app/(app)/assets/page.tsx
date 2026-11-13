import type { Metadata } from "next";
import { Suspense } from "react";

import { AssetsPage } from "@/features/assets/assets-page";

export const metadata: Metadata = { title: "Assets" };

export default function AssetsRoute(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <AssetsPage />
    </Suspense>
  );
}
