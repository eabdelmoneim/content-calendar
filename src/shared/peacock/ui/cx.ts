/** Joins truthy class names. */
export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

/** Peacock icon defaults (DESIGN.md › Iconography). */
export const ICON_SIZE = 16;
export const ICON_STROKE = 1.75;
