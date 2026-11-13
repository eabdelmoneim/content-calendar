/**
 * "Europe/Berlin · CET": the composer shows the device time zone it schedules
 * in, with the abbreviation for the chosen day (so summer reads CEST).
 */
export function timeZoneLabel(
  timeZone: string,
  date?: string,
): { label: string; abbreviation: string } {
  let abbreviation = "";
  try {
    const instant = date ? new Date(`${date}T12:00:00Z`) : new Date(0);
    abbreviation =
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        timeZoneName: "short",
      })
        .formatToParts(instant)
        .find((part) => part.type === "timeZoneName")?.value ?? "";
  } catch {
    abbreviation = "";
  }
  return {
    label: abbreviation ? `${timeZone} · ${abbreviation}` : timeZone,
    abbreviation,
  };
}
