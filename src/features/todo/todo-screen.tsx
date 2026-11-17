"use client";

import { useShellPane } from "@/shared/peacock/shell/shell-title";

import { TodoPanel } from "./todo-panel";

/** To-Do: its own sidebar screen, beside Posts, Analytics and Assets. */
export function TodoScreen(): React.JSX.Element {
  useShellPane();
  return <TodoPanel />;
}
