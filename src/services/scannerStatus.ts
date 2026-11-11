import { AppState, type AppStateStatus } from "react-native";

import { Config } from "../config";
import { Observable } from "../lib/observable";
import { appVersion, fetchWithTimeout } from "../net";
import { connectivity } from "./connectivity";

const BASE_INTERVAL_MS = 4_000;
const MAX_INTERVAL_MS = 30_000;
const TIMEOUT_MS = 6_000;

class ScannerStatusService {
  readonly active = new Observable<boolean>(true);
  readonly checking = new Observable<boolean>(false);
  readonly known = new Observable<boolean>(false);

  private timer: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  private foreground = true;
  private failures = 0;

  private get delay(): number {
    if (this.failures === 0) return BASE_INTERVAL_MS;
    const exp = Math.min(Math.max(this.failures, 1), 4);
    return Math.min(BASE_INTERVAL_MS * 2 ** exp, MAX_INTERVAL_MS);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    AppState.addEventListener("change", this.onAppState);
    connectivity.online.subscribe(this.onOnlineChanged);
    void this.check();
    this.schedule();
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.foreground) return;
    this.timer = setTimeout(async () => {
      await this.check();
      this.schedule();
    }, this.delay);
  }

  private onOnlineChanged = (): void => {
    if (connectivity.online.value) {
      this.failures = 0;
      void this.check();
    }
  };

  private onAppState = (state: AppStateStatus): void => {
    if (state === "active") {
      this.foreground = true;
      void this.check();
      this.schedule();
    } else if (state === "background") {
      this.foreground = false;
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
    }
  };

  check = async (): Promise<void> => {
    if (this.checking.value) return;
    if (!connectivity.online.value) return;

    this.checking.value = true;
    try {
      const result = await this.fetchStatus();
      if (result === null) {
        this.failures++;
      } else {
        this.failures = 0;
        if (!this.known.value) this.known.value = true;
        if (result !== this.active.value) {
          console.log(
            `[ScannerStatus] active: ${this.active.value} -> ${result}`,
          );
          this.active.value = result;
        }
      }
    } finally {
      this.checking.value = false;
    }
  };

  private async fetchStatus(): Promise<boolean | null> {
    try {
      const res = await fetchWithTimeout(
        `${Config.baseUrl}/tickets/scannerStatus`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "X-App-Version": appVersion(),
            "X-Scanner-Key": Config.scannerKey,
          },
        },
        TIMEOUT_MS,
      );

      if (res.status !== 200) {
        console.warn("[ScannerStatus]", res.status);
        return null;
      }
      connectivity.reportSuccess();
      const data = await res.json();
      return data?.result?.isScannerReady === true;
    } catch (e) {
      console.warn("[ScannerStatus] error:", e);
      connectivity.reportFailure();
      return null;
    }
  }
}

export const scannerStatus = new ScannerStatusService();
