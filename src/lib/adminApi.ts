"use client";

/** Thin wrappers around the operator's server routes (they hold the service key). */
async function call(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
  const res = await fetch(`/api/admin/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error((json as { error?: string } | null)?.error ?? `HTTP ${res.status}`);
  return json;
}

export const adminCreateEvent = (body: unknown) => call("events", "POST", body);
export const adminUpdateEvent = (body: unknown) => call("events", "PATCH", body);
export const adminDeleteEvent = (id: number) => call(`events?id=${id}`, "DELETE");
export const adminCreateSession = (body: unknown) => call("sessions", "POST", body);
export const adminDeleteSession = (id: number) => call(`sessions?id=${id}`, "DELETE");
export const adminSetExpected = (ids: string[], expected: boolean) =>
  call("members", "PATCH", { ids, expected });
