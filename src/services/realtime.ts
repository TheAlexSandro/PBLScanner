import { io, type Socket } from "socket.io-client";
import { AppState, type AppStateStatus } from "react-native";

import { Config } from "../config";
import { Observable } from "../lib/observable";
import { appVersion } from "../net";
import { connectivity } from "./connectivity";

export type ScannerStatusPayload = { active: boolean };
export type AppVersionPayload = {
  latestVersion: string;
  description: string;
  url: string;
};

class RealtimeService {
  readonly connected = new Observable<boolean>(false);

  private socket: Socket | null = null;
  private started = false;
  private foreground = true;

  private scannerListeners = new Set<(active: boolean) => void>();
  private versionListeners = new Set<(info: AppVersionPayload) => void>();

  start(): void {
    if (this.started) return;
    this.started = true;

    AppState.addEventListener("change", this.onAppState);
    connectivity.online.subscribe(() => {
      if (connectivity.online.value) this.connect();
      else this.disconnect();
    });
    if (connectivity.online.value) this.connect();
  }

  onScannerStatus(fn: (active: boolean) => void): () => void {
    this.scannerListeners.add(fn);
    return () => void this.scannerListeners.delete(fn);
  }

  onAppVersion(fn: (info: AppVersionPayload) => void): () => void {
    this.versionListeners.add(fn);
    return () => void this.versionListeners.delete(fn);
  }

  private connect(): void {
    if (this.socket || !this.foreground || !Config.isValid) return;

    const socket = io(`${Config.baseUrl}/wss`, {
      transports: ["websocket"],
      auth: { scannerKey: Config.scannerKey, appVersion: appVersion() },
      reconnection: true,
      reconnectionDelay: 2_000,
      reconnectionDelayMax: 15_000,
      secure: true,
    });
    this.socket = socket;

    socket.on("connect", () => {
      this.connected.value = true;
      connectivity.reportSuccess();
    });
    socket.on("disconnect", () => {
      this.connected.value = false;
    });
    socket.on("connect_error", () => connectivity.reportFailure());

    socket.on("scanner:status", (p: ScannerStatusPayload) => {
      this.scannerListeners.forEach((fn) => fn(p?.active === true));
    });
    socket.on("app:version", (p: AppVersionPayload) => {
      this.versionListeners.forEach((fn) => fn(p));
    });
  }

  private disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.connected.value = false;
  }

  private onAppState = (state: AppStateStatus): void => {
    this.foreground = state === "active";
    if (this.foreground) {
      if (connectivity.online.value) this.connect();
    } else {
      this.disconnect();
    }
  };
}

export const realtime = new RealtimeService();
