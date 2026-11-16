"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { useAssetTodos } from "@/lib/api";
import { useShellPane } from "@/shared/peacock/shell/shell-title";
import { Tabs } from "@/shared/peacock/ui";

import { AssetsPage } from "./assets-page";
import styles from "./assets-screen.module.css";
import { TodoPanel } from "./todo/todo-panel";

type AssetsTab = "library" | "todo";

function parseTab(value: string | null | undefined): AssetsTab | null {
  return value === "todo" || value === "library" ? value : null;
}

/**
 * Assets: the shared image library plus the To-do list of assets the team
 * plans to make. `?tab=todo` opens the list directly.
 */
export function AssetsScreen(): React.JSX.Element {
  useShellPane();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = parseTab(searchParams?.get("tab"));
  const [tab, setTabState] = useState<AssetsTab>(tabParam ?? "library");
  const [seenTabParam, setSeenTabParam] = useState(tabParam);
  if (tabParam !== seenTabParam) {
    setSeenTabParam(tabParam);
    if (tabParam) setTabState(tabParam);
  }
  const todos = useAssetTodos();
  const openCount = todos.data?.filter((todo) => todo.completedAt === null).length;

  function setTab(next: AssetsTab): void {
    setTabState(next);
    if (next === tab) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("asset");
    if (next === "library") params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    // router.replace doesn't drop parameters on this Next version (see the
    // Posts page); the History API also updates useSearchParams.
    window.history.replaceState(null, "", `${pathname ?? "/assets"}${query ? `?${query}` : ""}`);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Tabs<AssetsTab>
          label="Assets views"
          value={tab}
          onChange={setTab}
          items={[
            { value: "library", label: "Library" },
            {
              value: "todo",
              label: (
                <span className={styles.tabLabel}>
                  To-do
                  {openCount !== undefined ? <span className={styles.tabCount}>{openCount}</span> : null}
                </span>
              ),
            },
          ]}
        />
      </div>
      <div className={styles.body}>{tab === "todo" ? <TodoPanel /> : <AssetsPage />}</div>
    </div>
  );
}
