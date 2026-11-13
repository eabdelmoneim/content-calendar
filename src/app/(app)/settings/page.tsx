import type { Metadata } from "next";
import { Suspense } from "react";

import { SettingsPage } from "@/features/settings/settings-page";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsRoute(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <SettingsPage />
    </Suspense>
  );
}
