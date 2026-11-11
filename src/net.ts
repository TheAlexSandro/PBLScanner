import * as Application from "expo-application";

export function appVersion(): string {
  return Application.nativeApplicationVersion ?? "0.0.0";
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const isAbortError = (e: unknown): boolean =>
  e instanceof Error && e.name === "AbortError";
