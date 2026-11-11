import { MaterialIcons } from "@expo/vector-icons";
import { useRef } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ScanResult, ScanStatus } from "../api/scanApi";
import { AppTheme, hexA } from "../theme";
import { FilledButton } from "./FilledButton";
import type { IconName } from "./icons";

const STYLE: Record<ScanStatus, { color: string; icon: IconName }> = {
  valid: { color: AppTheme.success, icon: "check-circle" },
  alreadyScanned: { color: AppTheme.warning, icon: "warning-amber" },
  notFound: { color: AppTheme.danger, icon: "cancel" },
  error: { color: AppTheme.neutral, icon: "cloud-off" },
};

const two = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) =>
  `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()} ` +
  `${two(d.getHours())}:${two(d.getMinutes())}`;

type Props = { result: ScanResult | null; onClose: () => void };

export function ResultSheet({ result, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const last = useRef<ScanResult | null>(null);
  if (result) last.current = result;
  const r = result ?? last.current;

  return (
    <Modal
      visible={result !== null}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {r ? (
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.handle} />
            <ScrollView
              contentContainerStyle={styles.body}
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: hexA(STYLE[r.status].color, 36) },
                ]}
              >
                <MaterialIcons
                  name={STYLE[r.status].icon}
                  size={72}
                  color={STYLE[r.status].color}
                />
              </View>

              <Text style={[styles.message, { color: STYLE[r.status].color }]}>
                {r.message}
              </Text>

              {r.name ? (
                <>
                  <Text style={styles.name}>{r.name}</Text>
                  {r.kelas ? (
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>{r.kelas}</Text>
                    </View>
                  ) : null}
                </>
              ) : null}

              {r.status === "alreadyScanned" && r.scannedAt ? (
                <Text style={styles.time}>Di-scan pada {fmt(r.scannedAt)}</Text>
              ) : null}

              <View style={{ height: 24 }} />
              <FilledButton label="Scan lagi" onPress={onClose} />
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: AppTheme.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "90%",
  },
  handle: {
    alignSelf: "center",
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: AppTheme.textMuted,
    opacity: 0.4,
    marginTop: 12,
    marginBottom: 16,
  },
  body: { paddingHorizontal: 24, alignItems: "center" },
  iconWrap: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 16,
  },
  name: {
    color: AppTheme.text,
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 16,
  },
  chip: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: AppTheme.surfaceHigh,
  },
  chipText: { color: AppTheme.text, fontSize: 14 },
  time: {
    color: AppTheme.textMuted,
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
});
