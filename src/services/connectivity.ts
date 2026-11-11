import NetInfo from "@react-native-community/netinfo";
import { AppState, type AppStateStatus } from "react-native";

import { Config } from "../config";
import { Observable } from "../lib/observable";
import { fetchWithTimeout } from "../net";

const INTERVAL_MS = 15_000;
const PROBE_TIMEOUT_MS = 4_000;
const FAILURES_BEFORE_OFFLINE = 2;

type CheckOptions = { force?: boolean; strict?: boolean };

class ConnectivityService {
  readonly online = new Observable<boolean>(true);
  readonly checking = new Observable<boolean>(false);

  private started = false;
  private fails = 0;
  private lastOk = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running: Promise<void> | null = null;

  private get recentlyOk(): boolean {
    return Date.now() - this.lastOk < INTERVAL_MS;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    AppState.addEventListener("change", this.onAppState);
    NetInfo.addEventListener(() => {
      void this.check({ force: true });
    });
    this.startTimer();
    void this.check({ force: true, strict: true });
  }

  private startTimer(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.check(), INTERVAL_MS);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private onAppState = (state: AppStateStatus): void => {
    if (state === "active") {
      this.startTimer();
      void this.check({ force: true });
    } else if (state === "background") {
      this.stopTimer();
    }
  };

  reportSuccess(): void {
    this.lastOk = Date.now();
    this.fails = 0;
    if (!this.online.value) this.online.value = true;
  }

  reportFailure(): void {
    void this.check({ force: true, strict: true });
  }

  async ensureOnline(): Promise<boolean> {
    await this.check({ force: true, strict: true });
    return this.online.value;
  }

  check = (opts: CheckOptions = {}): Promise<void> => {
    const { force = false, strict = false } = opts;
    if (this.running) {
      return strict
        ? this.running.then(() => this.check({ force: true, strict: true }))
        : this.running;
    }
    const p = this.doCheck(force, strict).finally(() => {
      this.running = null;
    });
    this.running = p;
    return p;
  };

  private async doCheck(force: boolean, strict: boolean): Promise<void> {
    this.checking.value = true;
    try {
      const net = await NetInfo.fetch();
      if (net.isConnected === false) {
        this.fails = FAILURES_BEFORE_OFFLINE;
        this.online.value = false;
        return;
      }
      if (!force && this.online.value && this.recentlyOk) return;

      let ok = await this.reachable();
      if (!ok && strict) ok = await this.reachable();

      if (ok) {
        this.reportSuccess();
      } else {
        this.fails++;
        if (strict || this.fails >= FAILURES_BEFORE_OFFLINE) {
          this.online.value = false;
        }
      }
    } catch (e) {
      console.warn("[Connectivity] error:", e);
    } finally {
      this.checking.value = false;
    }
  }

  private async reachable(): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(
        `${Config.baseUrl}/`,
        {},
        PROBE_TIMEOUT_MS,
      );
      return res.status < 500;
    } catch {
      return false;
    }
  }
}

export const connectivity = new ConnectivityService();
