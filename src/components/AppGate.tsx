import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  BackHandler,
  Alert,
  Linking,
  StyleSheet,
  View,
} from "react-native";

import { useObservable } from "../lib/observable";
import { useGate } from "../services/gateState";
import { connectivity } from "../services/connectivity";
import { scannerStatus } from "../services/scannerStatus";
import { versionService } from "../services/version";
import { AppTheme } from "../theme";
import { StatusView } from "./StatusView";

export function AppGate({ children }: { children: ReactNode }) {
  const { blocker } = useGate();

  useEffect(() => {
    if (!blocker) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      BackHandler.exitApp();
      return true;
    });
    return () => sub.remove();
  }, [blocker]);

  return (
    <View style={styles.root}>
      {children}
      {blocker ? (
        <FadeIn key={blocker}>
          {blocker === "offline" ? (
            <OfflineView />
          ) : blocker === "update" ? (
            <UpdateView />
          ) : (
            <InactiveView />
          )}
        </FadeIn>
      ) : null}
    </View>
  );
}

function FadeIn({ children }: { children: ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: AppTheme.bg }]}>
      <Animated.View style={{ flex: 1, opacity }}>{children}</Animated.View>
    </View>
  );
}

function OfflineView() {
  const checking = useObservable(connectivity.checking);
  return (
    <StatusView
      icon="wifi-off"
      color={AppTheme.danger}
      title="Tidak ada koneksi internet"
      message={
        "Aplikasi membutuhkan internet untuk memeriksa tiket. " +
        "Periksa koneksi Anda lalu coba lagi."
      }
      actionLabel="Coba lagi"
      loading={checking}
      onAction={() => void connectivity.check({ force: true })}
    />
  );
}

function InactiveView() {
  const checking = useObservable(scannerStatus.checking);
  return (
    <StatusView
      icon="qr-code-scanner"
      color={AppTheme.warning}
      title="Scanner Tidak Aktif"
      message={
        "Anda tidak dapat menggunakan scanner saat ini.\n\n" +
        "Aktifkan scanner pada dashboard lewat menu\n" +
        "Pengaturan > Akses Scanner\n\n" +
        "Tautan dashboard dapat ditemukan pada spreadsheet"
      }
      actionLabel="Cek lagi"
      loading={checking}
      onAction={() => void scannerStatus.check()}
    />
  );
}

function UpdateView() {
  const info = useObservable(versionService.update);
  if (!info) return null;

  const open = async () => {
    try {
      await Linking.openURL(info.url);
    } catch {
      Alert.alert("Gagal", "Tidak bisa membuka link update");
    }
  };

  return (
    <StatusView
      icon="system-update"
      color={AppTheme.warning}
      title="Update Diperlukan"
      message={
        `Versi terbaru tersedia (v${info.latestVersion}).` +
        (info.description ? `\n\n${info.description}` : "")
      }
      actionLabel="Update"
      actionIcon="download"
      onAction={info.url ? () => void open() : undefined}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTheme.bg },
});
