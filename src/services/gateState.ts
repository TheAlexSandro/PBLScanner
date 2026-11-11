import { useSyncExternalStore } from "react";

import { connectivity } from "./connectivity";
import { scannerStatus } from "./scannerStatus";
import { versionService } from "./version";

export type GateBlock = "offline" | "update" | "inactive";

export function getBlocker(): GateBlock | null {
  if (!connectivity.online.value) return "offline";
  if (versionService.update.value !== null) return "update";
  if (!scannerStatus.active.value) return "inactive";
  return null;
}

export const isGateOpen = (): boolean =>
  getBlocker() === null && scannerStatus.known.value;

const sources: { subscribe: (l: () => void) => () => void }[] = [
  connectivity.online,
  versionService.update,
  scannerStatus.active,
  scannerStatus.known,
];

function subscribe(listener: () => void): () => void {
  const offs = sources.map((s) => s.subscribe(listener));
  return () => offs.forEach((off) => off());
}

const snapshot = (): string =>
  `${getBlocker() ?? "none"}|${scannerStatus.known.value}`;

export function useGate(): {
  blocker: GateBlock | null;
  known: boolean;
  open: boolean;
} {
  const s = useSyncExternalStore(subscribe, snapshot);
  const [b, k] = s.split("|");
  return {
    blocker: b === "none" ? null : (b as GateBlock),
    known: k === "true",
    open: b === "none" && k === "true",
  };
}
