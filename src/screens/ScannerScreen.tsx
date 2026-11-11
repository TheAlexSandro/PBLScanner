import { MaterialIcons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useIsFocused } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState } from "react";
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

type Props = NativeStackScreenProps<RootStackParamList, "Scanner">;

const DUPLICATE_WINDOW_MS = 1500;

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
  const [permission, requestPermission] = useCameraPermissions();

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const busy = useRef(false);
  const lastCode = useRef<string | null>(null);
  const lastScan = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    void scannerStatus.check();
    return () => {
      mounted.current = false;
    };
  }, []);

  const onScanned = useCallback(async (e: BarcodeScanningResult) => {
    if (busy.current || !isGateOpen()) return;

    const code = e.data?.trim();
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

  if (!open) return <GateClosed onBack={() => navigation.goBack()} />;
  if (!permission) return <View style={styles.root} />;
  if (!permission.granted) {
    return (
      <StatusView
        icon="videocam-off"
        color={AppTheme.warning}
        title="Izin Kamera Diperlukan"
        message="Aplikasi membutuhkan kamera untuk memindai kode QR pada tiket."
        actionLabel={
          permission.canAskAgain ? "Izinkan kamera" : "Buka pengaturan"
        }
        actionIcon="photo-camera"
        onAction={() =>
          permission.canAskAgain
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
      <View style={[StyleSheet.absoluteFill]}>
        {focused && !cameraError ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            zoom={zoom}
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={onScanned}
            onMountError={(e) => setCameraError(e.message)}
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
            {"Kamera tidak dapat dibuka\n"}({cameraError})
          </Text>
        </View>
      ) : null}

      {ready ? (
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
