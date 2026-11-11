import Svg, { Path } from "react-native-svg";

export type ScanWindow = { x: number; y: number; size: number };

const R = 24;
const LEN = 40;

type Props = {
  width: number;
  height: number;
  window: ScanWindow;
  color: string;
};

export function ScanOverlay({ width, height, window, color }: Props) {
  const l = window.x;
  const t = window.y;
  const rt = l + window.size;
  const b = t + window.size;

  const hole =
    `M${l + R},${t} H${rt - R} A${R},${R} 0 0 1 ${rt},${t + R} ` +
    `V${b - R} A${R},${R} 0 0 1 ${rt - R},${b} ` +
    `H${l + R} A${R},${R} 0 0 1 ${l},${b - R} ` +
    `V${t + R} A${R},${R} 0 0 1 ${l + R},${t} Z`;

  const dim = `M0,0 H${width} V${height} H0 Z ${hole}`;

  const corners =
    `M${l},${t + LEN} L${l},${t + R} A${R},${R} 0 0 1 ${l + R},${t} L${l + LEN},${t} ` +
    `M${rt - LEN},${t} L${rt - R},${t} A${R},${R} 0 0 1 ${rt},${t + R} L${rt},${t + LEN} ` +
    `M${rt},${b - LEN} L${rt},${b - R} A${R},${R} 0 0 1 ${rt - R},${b} L${rt - LEN},${b} ` +
    `M${l + LEN},${b} L${l + R},${b} A${R},${R} 0 0 1 ${l},${b - R} L${l},${b - LEN}`;

  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Path d={dim} fill="rgba(0,0,0,0.55)" fillRule="evenodd" />
      <Path
        d={corners}
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
