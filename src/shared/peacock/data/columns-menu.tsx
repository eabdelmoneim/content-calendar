"use client";

import { Columns3 } from "lucide-react";
import { Button } from "../ui/button";
import { ICON_SIZE, ICON_STROKE } from "../ui/cx";
import {
  Popover,
  PopoverMenuCheckboxItem,
  PopoverMenuGroup,
} from "../ui/popover";
import type { DataTableColumnOption } from "./data-table";

export type ColumnsMenuProps = {
  /** From `columnOptions(columns)`. */
  columns: DataTableColumnOption[];
  /** The same controlled set passed to DataTable `hiddenColumns`. */
  hidden: ReadonlySet<string>;
  onHiddenChange: (next: Set<string>) => void;
  /** Trailing note on locked rows. */
  lockedNote?: string;
  align?: "start" | "end";
};

/** "Columns" button with a menuitemcheckbox per column (Leads › toolbar). */
export function ColumnsMenu({
  columns,
  hidden,
  onHiddenChange,
  lockedNote = "Always shown",
  align = "end",
}: ColumnsMenuProps): React.JSX.Element {
  return (
    <Popover
      label="Show columns"
      role="menu"
      align={align}
      trigger={(props) => (
        <Button
          {...props}
          icon={<Columns3 size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
        >
          Columns
        </Button>
      )}
    >
      <PopoverMenuGroup label="Show columns">
        {columns.map((column) => (
          <PopoverMenuCheckboxItem
            key={column.id}
            checked={column.locked || !hidden.has(column.id)}
            disabled={column.locked}
            meta={column.locked ? lockedNote : undefined}
            onCheckedChange={(checked) => {
              const next = new Set(hidden);
              if (checked) next.delete(column.id);
              else next.add(column.id);
              onHiddenChange(next);
            }}
          >
            {column.label}
          </PopoverMenuCheckboxItem>
        ))}
      </PopoverMenuGroup>
    </Popover>
  );
}
