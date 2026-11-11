export const AppTheme = {
  bg: "#0F1115",
  surface: "#181B22",
  surfaceHigh: "#232834",
  outline: "#2A2F3A",
  primary: "#3B82F6",
  text: "#E6E8EE",
  textMuted: "#A3A9B8",

  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  neutral: "#94A3B8",
} as const;

export const hexA = (hex: string, alpha: number): string =>
  hex + Math.round(alpha).toString(16).padStart(2, "0");

export function onColorFor(hex: string): string {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) =>
      v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4),
    );
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (lum + 0.05) ** 2 > 0.15 ? "#000000" : "#FFFFFF";
}
