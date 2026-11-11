const baseUrl = (process.env.EXPO_PUBLIC_BASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "");
const scannerKey = (process.env.EXPO_PUBLIC_SCANNER_KEY ?? "").trim();

export const Config = {
  baseUrl,
  scannerKey,
  get isValid(): boolean {
    return baseUrl.length > 0 && scannerKey.length > 0;
  },
};
