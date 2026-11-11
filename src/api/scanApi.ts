import { Config } from "../config";
import { appVersion, fetchWithTimeout, isAbortError } from "../net";
import { connectivity } from "../services/connectivity";

export type ScanStatus = "valid" | "alreadyScanned" | "notFound" | "error";

export type ScanResult = {
  status: ScanStatus;
  message: string;
  name?: string;
  kelas?: string;
  scannedAt?: Date;
};

const errorResult = (message: string): ScanResult => ({
  status: "error",
  message,
});

const isObject = (v: unknown): v is Record<string, any> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function messageOf(data: Record<string, any>): string | null {
  const m = data.message;
  if (Array.isArray(m)) return m.join(", ");
  if (typeof m === "string") return m;
  return null;
}

export async function scanTicket(code: string): Promise<ScanResult> {
  try {
    const res = await fetchWithTimeout(
      `${Config.baseUrl}/tickets/scan`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-App-Version": appVersion(),
          "X-Scanner-Key": Config.scannerKey,
        },
        body: JSON.stringify({ code }),
      },
      8_000,
    );

    connectivity.reportSuccess();

    let data: Record<string, any> = {};
    try {
      const parsed = JSON.parse(await res.text());
      if (isObject(parsed)) data = parsed;
    } catch {}

    if (res.status === 401) return errorResult("Kunci scanner tidak valid");
    if (res.status === 426) {
      return errorResult("Versi aplikasi sudah usang. Silakan update.");
    }

    const result = data.result;
    if (!isObject(result)) {
      return errorResult(
        messageOf(data) ?? `Server bermasalah (${res.status})`,
      );
    }

    const ticket = isObject(result.ticket) ? result.ticket : null;
    const valid = result.valid === true;

    let scannedAt: Date | undefined;
    if (result.scannedAt) {
      const d = new Date(String(result.scannedAt));
      if (!Number.isNaN(d.getTime())) scannedAt = d;
    }

    return {
      status: valid ? "valid" : ticket ? "alreadyScanned" : "notFound",
      message: messageOf(data) ?? "",
      name: ticket?.name != null ? String(ticket.name) : undefined,
      kelas: ticket?.kelas != null ? String(ticket.kelas) : undefined,
      scannedAt,
    };
  } catch (e) {
    if (isAbortError(e)) {
      connectivity.reportFailure();
      return errorResult(
        "Server lambat merespons. Scan ulang; jika tiket tercatat " +
          '"baru saja di-scan", berarti tiket tersebut sah.',
      );
    }
    if (e instanceof TypeError) {
      connectivity.reportFailure();
      return errorResult("Tidak dapat terhubung ke server.");
    }
    console.warn("[ScanApi] error:", e);
    return errorResult("Terjadi kesalahan. Coba scan lagi.");
  }
}
