import { MaterialIcons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FilledButton } from "../components/FilledButton";
import type { IconName } from "../components/icons";
import { VersionLabel } from "../components/VersionLabel";
import type { RootStackParamList } from "../navigation";
import { connectivity } from "../services/connectivity";
import { AppTheme } from "../theme";
import { useObservable } from "../lib/observable";
import { homeIconService } from "../services/homeIcon";
import { useObserve } from "expo-observe";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

function InfoRow({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.infoRow}>
      <MaterialIcons name={icon} size={24} color={AppTheme.primary} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const { markInteractive } = useObserve();
  const [opening, setOpening] = useState(false);
  const lock = useRef(false);
  const remoteLogo = useObservable(homeIconService.source);

  useEffect(() => {
    markInteractive()
  }, [markInteractive])
  
  const openScanner = async () => {
    if (lock.current) return;
    lock.current = true;
    setOpening(true);
    const online = await connectivity.ensureOnline();
    setOpening(false);
    lock.current = false;
    if (!online) return;
    navigation.navigate("Scanner");
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Image
            source={
              remoteLogo
                ? { uri: remoteLogo }
                : require("../../assets/logo.png")
            }
            style={styles.logo}
            resizeMode="contain"
            onError={() => homeIconService.clear()}
          />
          <Text style={styles.title}>Scan Tiket</Text>
          <Text style={styles.subtitle}>
            Pemindai tiket puncak Dies Natalis SMKN 1 Blitar
          </Text>

          <View style={styles.card}>
            <InfoRow
              icon="qr-code-2"
              text="Arahkan kamera ke kode QR pada tiket"
            />
            <View style={{ height: 12 }} />
            <InfoRow icon="bolt" text="Hasil pemeriksaan muncul otomatis" />
          </View>

          <View style={{ height: 32 }} />
          <FilledButton
            icon="qr-code-scanner"
            label={opening ? "Memeriksa koneksi..." : "Mulai Scan"}
            loading={opening}
            onPress={openScanner}
          />
        </View>
      </ScrollView>
      <VersionLabel />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTheme.bg },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  content: { width: "100%", maxWidth: 420, alignItems: "center" },
  logo: { width: 120, height: 120, marginBottom: 32 },
  title: { color: AppTheme.text, fontSize: 28, fontWeight: "bold" },
  subtitle: {
    color: AppTheme.textMuted,
    fontSize: 16,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 28,
  },
  card: {
    alignSelf: "stretch",
    padding: 16,
    borderRadius: 20,
    backgroundColor: AppTheme.surface,
    borderWidth: 1,
    borderColor: AppTheme.outline,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  infoText: { flex: 1, color: AppTheme.text, fontSize: 14 },
});
