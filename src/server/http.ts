import "server-only";

import { NextResponse } from "next/server";

/** A failure the API reports to the browser with a typed code. */
export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function fail(status: number, code: string, message: string): never {
  throw new ApiFailure(status, code, message);
}

/** Wrap a route: typed failures become JSON errors, anything else is a 500 that is logged. */
export async function handle(run: () => Promise<unknown>): Promise<Response> {
  try {
    const body = await run();
    if (body instanceof Response) return body;
    return NextResponse.json(body ?? { ok: true });
  } catch (error) {
    if (error instanceof ApiFailure) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("[content-calendar] route failed", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: { code: "internal", message } },
      { status: 500 },
    );
  }
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    fail(400, "bad_json", "The request body is not valid JSON.");
  }
}

/** PostgREST result → data, or a 500 naming the table operation. */
export function must<T>(
  result: { data: T | null; error: { message: string; code?: string } | null },
  what: string,
): T {
  if (result.error) {
    if (result.error.code === "42P01" || result.error.code === "PGRST205") {
      fail(
        503,
        "tables_missing",
        "The Content Calendar tables are not in Supabase yet. Apply supabase/migrations/0001_content_calendar.sql.",
      );
    }
    throw new Error(`${what}: ${result.error.message}`);
  }
  if (result.data === null) throw new Error(`${what}: no data returned`);
  return result.data;
}
