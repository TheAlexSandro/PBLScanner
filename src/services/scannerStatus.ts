import { Config } from "../config";
import { Observable } from "../lib/observable";
import { appVersion, fetchWithTimeout } from "../net";
import { connectivity } from "./connectivity";
import { realtime } from "./realtime";

const FALLBACK_INTERVAL_MS = 15_000;
const FALLBACK_MAX_MS = 120_000;
const TIMEOUT_MS = 6_000;

class ScannerStatusService {
  readonly active = new Observable<boolean>(true);
  readonly checking = new Observable<boolean>(false);
  readonly known = new Observable<boolean>(false);

  private timer: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  private failures = 0;

  private get delay(): number {
    if (this.failures === 0) return FALLBACK_INTERVAL_MS;
    const exp = Math.min(Math.max(this.failures, 1), 4);
    return Math.min(FALLBACK_INTERVAL_MS * 2 ** exp, FALLBACK_MAX_MS);
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    realtime.onScannerStatus((active) => {
      this.failures = 0;
      this.apply(active);
    });

    realtime.connected.subscribe(() => {
      if (realtime.connected.value) this.stopFallback();
      else this.startFallback();
    });
    if (!realtime.connected.value) this.startFallback();
  }

  private apply(active: boolean): void {
    if (!this.known.value) this.known.value = true;
    if (active !== this.active.value) {
      console.log(`[ScannerStatus] active: ${this.active.value} -> ${active}`);
      this.active.value = active;
    }
  }

  check = async (): Promise<void> => {
    if (this.checking.value) return;
    if (!connectivity.online.value) return;

    this.checking.value = true;
    try {
      const result = await this.fetchStatus();
      if (result === null) this.failures++;
      else {
        this.failures = 0;
        this.apply(result);
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
      if (res.status !== 200) return null;
      connectivity.reportSuccess();
      const data = await res.json();
      return data?.result?.isScannerReady === true;
    } catch {
      connectivity.reportFailure();
      return null;
    }
  }

  private startFallback(): void {
    if (this.timer) return;
    const tick = async (): Promise<void> => {
      await this.check();
      this.timer = setTimeout(tick, this.delay);
    };
    void tick();
  }

  private stopFallback(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

export const scannerStatus = new ScannerStatusService();
