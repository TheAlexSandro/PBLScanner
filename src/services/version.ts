import { AppState } from "react-native";

import { Config } from "../config";
import { Observable } from "../lib/observable";
import { appVersion, fetchWithTimeout } from "../net";
import { connectivity } from "./connectivity";

export type UpdateInfo = {
  latestVersion: string;
  description: string;
  url: string;
};

const TIMEOUT_MS = 6_000;

function isNewer(latest: string, current: string): boolean {
  const parse = (v: string) =>
    v
      .split("+")[0]
      .split(".")
      .map((e) => (/^\d+$/.test(e) ? Number(e) : 0));

  const a = parse(latest);
  const b = parse(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

class VersionService {
  readonly update = new Observable<UpdateInfo | null>(null);

  private started = false;
  private checking = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    AppState.addEventListener("change", (s) => {
      if (s === "active") void this.check();
    });
    connectivity.online.subscribe(() => {
      if (connectivity.online.value) void this.check();
    });
  }

  check = async (): Promise<void> => {
    if (this.checking) return;
    this.checking = true;
    try {
      const current = appVersion();
      const res = await fetchWithTimeout(
        `${Config.baseUrl}/app/version`,
        {},
        TIMEOUT_MS,
      );
      if (res.status !== 200) {
        console.warn("[Version]", res.status);
        return;
      }

      const body = await res.json();
      const inner = body?.result;
      const data = inner && typeof inner === "object" ? inner : body;

      const latest = String(data?.latestVersion ?? "");
      console.log(`[Version] current=${current} latest=${latest}`);

      if (!latest || !isNewer(latest, current)) {
        this.update.value = null;
        return;
      }

      const next: UpdateInfo = {
        latestVersion: latest,
        description: String(data?.description ?? ""),
        url: String(data?.url ?? ""),
      };
      const prev = this.update.value;
      const same =
        prev &&
        prev.latestVersion === next.latestVersion &&
        prev.description === next.description &&
        prev.url === next.url;
      if (!same) this.update.value = next;
    } catch (e) {
      console.warn("[Version] error:", e);
    } finally {
      this.checking = false;
    }
  };
}

export const versionService = new VersionService();
