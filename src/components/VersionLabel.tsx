import { StyleSheet, Text } from "react-native";

import { appVersion } from "../net";
import { AppTheme } from "../theme";

export function VersionLabel() {
  return <Text style={styles.text}>v{appVersion()}</Text>;
}

const styles = StyleSheet.create({
  text: {
    textAlign: "center",
    color: AppTheme.textMuted,
    fontSize: 12,
    marginTop: 8,
    marginBottom: 16,
  },
});
