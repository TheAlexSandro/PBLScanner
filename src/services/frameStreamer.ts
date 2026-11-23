import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Config } from "../config";
import { appVersion } from "../net";

type Options = {
  label?: string;
  enabled: boolean;
  capture: () => Promise<ArrayBuffer | null>;
  intervalMs?: number;
};

const makeId = () =>
  `s${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

export function frameStreamer({
  label = "Scanner",
  enabled,
  capture,
  intervalMs = 66,
}: Options) {
  const [deviceId] = useState(makeId);
  const [viewers, setViewers] = useState(0);
  const [status, setStatus] = useState<
    "idle" | "connecting" | "online" | "error"
  >("idle");
  const socketRef = useRef<Socket | null>(null);
  const captureRef = useRef(capture);
  captureRef.current = capture;

  const hasViewers = viewers > 0;

  useEffect(() => {
    if (!enabled) return;
    const ids = new Set<string>();
    setStatus("connecting");

    const socket = io(`${Config.baseUrl}/stream`, {
      transports: ["websocket"],
      auth: {
        scannerKey: Config.scannerKey,
        appVersion: appVersion(),
        deviceId,
        label,
      },
    });
    socketRef.current = socket;

    socket.on("connect", () => setStatus("online"));
    socket.on("connect_error", (e) => {
      setStatus("error");
    });
    socket.on("viewer-joined", ({ viewerId }) => {
      ids.add(viewerId);
      setViewers(ids.size);
    });
    socket.on("viewer-left", ({ viewerId }) => {
      ids.delete(viewerId);
      setViewers(ids.size);
    });
    socket.on("disconnect", () => {
      ids.clear();
      setViewers(0);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setViewers(0);
      setStatus("idle");
    };
  }, [enabled, deviceId, label]);

  useEffect(() => {
    if (!enabled || !hasViewers) return;
    let stop = false;
    let sent = 0;
    let lastLog = Date.now();
    let inFlight = false;

    (async () => {
      while (!stop) {
        const started = Date.now();
        let failed = false;
        try {
          const frame = await captureRef.current();
          const socket = socketRef.current;
          if (frame && socket?.connected && !inFlight) {
            inFlight = true;
            socket.timeout(1000).emit("frame", new Uint8Array(frame), () => {
              inFlight = false;
            });
            sent++;
          }
        } catch {
          failed = true;
        }

        if (Date.now() - lastLog >= 2000) {
          sent = 0;
          lastLog = Date.now();
        }

        const wait = (failed ? 500 : intervalMs) - (Date.now() - started);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      }
    })();

    return () => {
      stop = true;
    };
  }, [enabled, hasViewers, intervalMs]);

  return { deviceId, viewers, status };
}
