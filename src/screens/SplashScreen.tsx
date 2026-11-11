import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";

import type { RootStackParamList } from "../navigation";
import { connectivity } from "../services/connectivity";
import { versionService } from "../services/version";
import { homeIconService } from "../services/homeIcon";
import { scannerStatus } from "../services/scannerStatus";
import { AppTheme } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Splash">;

function waitUntilOnline(): Promise<void> {
  const online = connectivity.online;
  if (online.value) return Promise.resolve();
  return new Promise((resolve) => {
    const off = online.subscribe(() => {
      if (online.value) {
        off();
        resolve();
      }
    });
  });
}

export default function SplashScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const maxW = Math.min(width * 0.7, 180);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    (async () => {
      await connectivity.ensureOnline();
      await waitUntilOnline();
      if (!alive.current) return;

      try {
        await Promise.all([
          versionService.check(),
          scannerStatus.check(),
          homeIconService.load(),
        ]);
      } catch {}
      if (!alive.current) return;

      navigation.replace("Home");
    })();
    return () => {
      alive.current = false;
    };
  }, [navigation]);

  return (
    <View style={styles.root}>
      <Image
        source={require("../../assets/icon.png")}
        style={{ width: maxW, height: maxW }}
        resizeMode="contain"
      />
      <ActivityIndicator
        size="large"
        color={AppTheme.primary}
        style={{ marginTop: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.bg,
  },
});
