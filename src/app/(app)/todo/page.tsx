import type { Metadata } from "next";
import { Suspense } from "react";

import { TodoScreen } from "@/features/todo/todo-screen";

export const metadata: Metadata = { title: "To-Do" };

export default function TodoRoute(): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <TodoScreen />
    </Suspense>
  );
}
