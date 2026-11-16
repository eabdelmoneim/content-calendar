"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { useNativeEditing } from "@/shared/clipboard/use-native-editing";

export function Providers({ children }: { children: React.ReactNode }): React.JSX.Element {
  useNativeEditing();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } },
      }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
