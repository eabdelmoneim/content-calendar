import type { Metadata } from "next";
import { Suspense } from "react";

import { AssetsScreen } from "@/features/assets/assets-screen";

export const metadata: Metadata = { title: "Assets" };

export default function AssetsRoute(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <AssetsScreen />
    </Suspense>
  );
}
