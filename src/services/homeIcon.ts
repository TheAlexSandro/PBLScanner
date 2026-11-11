import { AppState } from "react-native";

import { Config } from "../config";
import { Observable } from "../lib/observable";
import { fetchWithTimeout } from "../net";
import { connectivity } from "./connectivity";

const TIMEOUT_MS = 10_000;

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Gagal membaca gambar"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

class HomeIconService {
  readonly source = new Observable<string | null>(null);

  private started = false;
  private inflight: Promise<void> | null = null;
  start(): void {
    if (this.started) return;
    this.started = true;

    AppState.addEventListener("change", (state) => {
      if (state === "active") void this.load();
    });
    connectivity.online.subscribe(() => {
      if (connectivity.online.value && !this.source.value) void this.load();
    });

    void this.load();
  }

  clear(): void {
    this.source.value = null;
  }

  load = (): Promise<void> => {
    if (this.inflight) return this.inflight;
    const p = this.fetchIcon().finally(() => {
      this.inflight = null;
    });
    this.inflight = p;
    return p;
  };

  private async fetchIcon(): Promise<void> {
    try {
      const res = await fetchWithTimeout(
        `${Config.baseUrl}/configs/getHomeIcon`,
        {
          headers: {
            "Cache-Control": "no-cache",
          },
        },
        TIMEOUT_MS,
      );

      if (res.status !== 200) {
        console.warn("[HomeIcon]", res.status);
        return;
      }

      const type = res.headers.get("content-type") ?? "";
      if (!type.startsWith("image/")) {
        console.warn("[HomeIcon] bukan gambar:", type);
        return;
      }

      this.source.value = await blobToDataUri(await res.blob());
    } catch (e) {
      console.warn("[HomeIcon] error:", e);
    }
  }
}

export const homeIconService = new HomeIconService();
