import { MaterialIcons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useIsFocused } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  type CameraRef,
} from "react-native-vision-camera";
import {
  useBarcodeScanner,
  type Barcode,
  type TargetBarcodeFormat,
} from "react-native-vision-camera-barcode-scanner";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFrameOutput, CommonResolutions } from "react-native-vision-camera";
import { createSynchronizable, scheduleOnRN } from "react-native-worklets";
import type { Image } from "react-native-nitro-image";
import { NitroModules } from "react-native-nitro-modules";
import type { FrameConverter } from "react-native-vision-camera";

import { scanTicket, type ScanResult, type ScanStatus } from "../api/scanApi";
import { ResultSheet } from "../components/ResultSheet";
import { ScanOverlay } from "../components/ScanOverlay";
import { StatusView } from "../components/StatusView";
import type { IconName } from "../components/icons";
import { useObservable } from "../lib/observable";
import type { RootStackParamList } from "../navigation";
import { isGateOpen, useGate } from "../services/gateState";
import { scannerStatus } from "../services/scannerStatus";
import { AppTheme } from "../theme";
import { frameStreamer } from "../frameStreamer";

type Props = NativeStackScreenProps<RootStackParamList, "Scanner">;

const DUPLICATE_WINDOW_MS = 1500;
const BARCODE_FORMATS: TargetBarcodeFormat[] = ["qr-code"];
const MAX_ZOOM = 8;
const STREAM_WIDTH = 320;
const STREAM_QUALITY = 40;

function feedback(s: ScanStatus) {
  switch (s) {
    case "valid":
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;
    case "alreadyScanned":
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      break;
    default:
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
}

function IconButton({
  icon,
  color = "#FFFFFF",
  onPress,
  disabled,
}: {
  icon: IconName;
  color?: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={styles.iconBtn}
    >
      <MaterialIcons name={icon} size={24} color={color} />
    </Pressable>
  );
}

export default function ScannerScreen({ navigation }: Props) {
  useKeepAwake();

  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { open } = useGate();
  const { hasPermission, canRequestPermission, requestPermission } =
    useCameraPermission();
  const device = useCameraDevice("back");

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const busy = useRef(false);
  const lastCode = useRef<string | null>(null);
  const lastScan = useRef(0);
  const mounted = useRef(true);
  const cameraRef = useRef<CameraRef>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const latestJpeg = useRef<ArrayBuffer | null>(null);
  const encoding = useRef(false);

  const converter = useMemo(
    () => NitroModules.createHybridObject<FrameConverter>("FrameConverter"),
    [],
  );
  const barcodeScanner = useBarcodeScanner({ barcodeFormats: BARCODE_FORMATS });

  const onScanned = useCallback(async (raw: string) => {
    if (busy.current || !isGateOpen()) return;

    const code = raw.trim();
    if (!code) return;

    const now = Date.now();
    if (
      code === lastCode.current &&
      now - lastScan.current < DUPLICATE_WINDOW_MS
    )
      return;

    busy.current = true;
    lastCode.current = code;
    lastScan.current = now;
    setLoading(true);
    void Haptics.selectionAsync();

    const r = await scanTicket(code);
    void scannerStatus.check();
    if (!mounted.current) return;

    setLoading(false);
    feedback(r.status);
    setResult(r);
  }, []);

  const dismiss = useCallback(() => {
    setResult(null);
    lastScan.current = Date.now();
    busy.current = false;
  }, []);

  const handleImage = useCallback(async (image: Image) => {
    if (encoding.current) {
      image.dispose();
      return;
    }
    encoding.current = true;
    try {
      const w = Math.min(STREAM_WIDTH, image.width);
      const h = Math.round((image.height * w) / image.width);
      const small = w < image.width ? await image.resizeAsync(w, h) : image;
      try {
        const enc = await small.toEncodedImageDataAsync("jpg", STREAM_QUALITY);
        latestJpeg.current = enc.buffer;
      } finally {
        if (small !== image) small.dispose();
      }
    } catch (e) {
      console.log("[enc] error", e);
    } finally {
      encoding.current = false;
      image.dispose();
    }
  }, []);

  const frameOutput = useFrameOutput({
    pixelFormat: "yuv",
    targetResolution: CommonResolutions.HD_16_9,
    enablePhysicalBufferRotation: true,
    onFrame(frame) {
      "worklet";
      try {
        const g = globalThis as any;
        const now = Date.now();

        if (now - (g.__scanTs ?? 0) >= 150) {
          g.__scanTs = now;
          const barcodes = barcodeScanner.scanCodes(frame);
          const value = barcodes.find((b: Barcode) => b.rawValue)?.rawValue;
          if (value) scheduleOnRN(onScanned, value);
        }

        if (now - (g.__streamTs ?? 0) < 66) return;
        g.__streamTs = now;
        const image = converter.convertFrameToImage(frame);
        scheduleOnRN(handleImage, image);
      } catch (e) {
        console.log("[frame] error", String(e));
      } finally {
        frame.dispose();
      }
    },
  });

  const capture = useCallback(async () => {
    const buf = latestJpeg.current;
    latestJpeg.current = null;
    return buf;
  }, []);

  frameStreamer({
    enabled: acknowledged && cameraReady && !cameraError,
    capture,
  });

  useEffect(() => {
    mounted.current = true;
    void scannerStatus.check();
    return () => {
      mounted.current = false;
    };
  }, []);

  if (!open) return <GateClosed onBack={() => navigation.goBack()} />;
  if (!acknowledged)
    return (
      <StreamNotice
        onAccept={() => setAcknowledged(true)}
        onBack={() => navigation.goBack()}
      />
    );
  if (!hasPermission) {
    return (
      <StatusView
        icon="videocam-off"
        color={AppTheme.warning}
        title="Izin Kamera Diperlukan"
        message="Aplikasi membutuhkan kamera untuk memindai kode QR pada tiket."
        actionLabel={
          canRequestPermission ? "Izinkan kamera" : "Buka pengaturan"
        }
        actionIcon="photo-camera"
        onAction={() =>
          canRequestPermission
            ? void requestPermission()
            : void Linking.openSettings()
        }
      />
    );
  }

  const side = size.w * 0.72;
  const window = {
    x: (size.w - side) / 2,
    y: size.h * 0.45 - side / 2,
    size: side,
  };
  const ready = size.w > 0 && size.h > 0;

  return (
    <View
      style={styles.root}
      onLayout={(e: LayoutChangeEvent) =>
        setSize({
          w: e.nativeEvent.layout.width,
          h: e.nativeEvent.layout.height,
        })
      }
    >
      <View style={StyleSheet.absoluteFill}>
        {!cameraError && device ? (
          <Camera
            ref={cameraRef}
            constraints={[{ fps: 30 }]}
            outputs={[frameOutput]}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={focused}
            torchMode={cameraReady ? (torch ? "on" : "off") : undefined}
            zoom={
              cameraReady
                ? device.minZoom +
                  zoom * (Math.min(device.maxZoom, MAX_ZOOM) - device.minZoom)
                : undefined
            }
            resizeMode="cover"
            onPreviewStarted={() => setCameraReady(true)}
            onPreviewStopped={() => setCameraReady(false)}
            onError={(e) => setCameraError(e.message)}
          />
        ) : null}
      </View>

      {cameraError ? (
        <View style={styles.cameraError}>
          <MaterialIcons
            name="videocam-off"
            size={56}
            color="rgba(255,255,255,0.7)"
          />
          <Text style={styles.cameraErrorText}>
            {"Kamera tidak dapat dibuka\n"}({cameraError.substring(0, 700)})
          </Text>
        </View>
      ) : null}

      {ready && !cameraError ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <ScanOverlay
            width={size.w}
            height={size.h}
            window={window}
            color={loading ? AppTheme.primary : "#FFFFFF"}
          />
          <Text style={[styles.hint, { top: window.y + window.size + 20 }]}>
            Arahkan kamera ke kode QR tiket
          </Text>
        </View>
      ) : null}

      <LinearGradient
        colors={["rgba(0,0,0,0.87)", "transparent"]}
        style={[styles.topBar, { paddingTop: insets.top + 4 }]}
      >
        <IconButton icon="arrow-back" onPress={() => navigation.goBack()} />
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            SMKN 1 Blitar
          </Text>
          <Text style={styles.subtitle}>Aplikasi Pemindai Tiket</Text>
        </View>
        <IconButton
          icon={torch ? "flash-on" : "flash-off"}
          color={torch ? "#FACC15" : "#FFFFFF"}
          onPress={() => setTorch((v) => !v)}
        />
      </LinearGradient>

      <View style={[styles.zoomBar, { bottom: insets.bottom + 20 }]}>
        <MaterialIcons name="zoom-out" size={24} color="#FFFFFF" />
        <Slider
          style={{ flex: 1, height: 40 }}
          minimumValue={0}
          maximumValue={1}
          value={zoom}
          onValueChange={setZoom}
          minimumTrackTintColor={AppTheme.primary}
          maximumTrackTintColor="rgba(255,255,255,0.35)"
          thumbTintColor={AppTheme.primary}
        />
        <MaterialIcons name="zoom-in" size={24} color="#FFFFFF" />
      </View>

      {loading ? (
        <View style={styles.loadingBackdrop}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={AppTheme.primary} />
            <Text style={styles.loadingText}>Memeriksa tiket...</Text>
          </View>
        </View>
      ) : null}

      <ResultSheet result={result} onClose={dismiss} />
    </View>
  );
}

function StreamNotice({
  onAccept,
  onBack,
}: {
  onAccept: () => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: AppTheme.bg }}>
      <StatusView
        icon="photo-camera-front"
        color={AppTheme.warning}
        title="Kamera Akan Dipantau"
        message="Selama layar scanner terbuka, tampilan kamera perangkat ini akan disiarkan langsung (streaming) ke dashboard web untuk keperluan pemantauan."
        actionLabel="Mengerti, Mulai Scan"
        actionIcon="check"
        onAction={onAccept}
      />
      <View style={{ position: "absolute", top: insets.top + 4, left: 8 }}>
        <IconButton icon="arrow-back" color={AppTheme.text} onPress={onBack} />
      </View>
    </View>
  );
}

function GateClosed({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const checking = useObservable(scannerStatus.checking);

  return (
    <View style={styles.root}>
      <View style={{ position: "absolute", top: insets.top + 4, left: 8 }}>
        <IconButton icon="arrow-back" onPress={onBack} />
      </View>
      <View style={styles.center}>
        {checking ? (
          <ActivityIndicator size="large" color={AppTheme.primary} />
        ) : (
          <Pressable
            style={styles.retry}
            onPress={() => void scannerStatus.check()}
          >
            <MaterialIcons name="refresh" size={20} color={AppTheme.primary} />
            <Text style={styles.retryText}>Coba lagi</Text>
          </Pressable>
        )}
        <Text style={styles.checkingText}>Memeriksa status scanner...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  retry: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  retryText: { color: AppTheme.primary, fontSize: 16, fontWeight: "600" },
  checkingText: { color: "rgba(255,255,255,0.7)" },

  iconBtn: { padding: 8 },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  titleWrap: { flex: 1, alignItems: "center" },
  title: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  subtitle: { color: "rgba(255,255,255,0.7)", fontSize: 12 },

  hint: {
    position: "absolute",
    left: 24,
    right: 24,
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "500",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowRadius: 6,
  },

  zoomBar: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.54)",
  },

  cameraError: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  cameraErrorText: { color: "#FFFFFF", textAlign: "center" },

  loadingBackdrop: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.54)",
  },
  loadingCard: {
    alignItems: "center",
    paddingHorizontal: 40,
    paddingVertical: 28,
    borderRadius: 24,
    backgroundColor: AppTheme.surface,
    gap: 20,
  },
  loadingText: { color: AppTheme.text, fontSize: 17, fontWeight: "600" },
});
