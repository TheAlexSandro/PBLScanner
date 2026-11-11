import { MaterialIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppTheme, hexA } from "../theme";
import { FilledButton } from "./FilledButton";
import type { IconName } from "./icons";
import { VersionLabel } from "./VersionLabel";

type Props = {
  icon: IconName;
  color: string;
  title: string;
  message: string;
  actionLabel: string;
  onAction?: () => void;
  actionIcon?: IconName;
  loading?: boolean;
  footer?: ReactNode;
};

export function StatusView({
  icon,
  color,
  title,
  message,
  actionLabel,
  onAction,
  actionIcon = "refresh",
  loading = false,
  footer,
}: Props) {
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: hexA(color, 32),
                borderColor: hexA(color, 90),
              },
            ]}
          >
            <MaterialIcons name={icon} size={60} color={color} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {footer ? <View style={{ marginTop: 12 }}>{footer}</View> : null}
          <View style={{ height: 32 }} />
          <FilledButton
            label={loading ? "Memeriksa..." : actionLabel}
            icon={actionIcon}
            color={color}
            loading={loading}
            onPress={onAction}
          />
        </View>
      </ScrollView>
      <VersionLabel />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTheme.bg },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  content: { width: "100%", maxWidth: 420, alignItems: "center" },
  iconWrap: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  title: {
    color: AppTheme.text,
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  message: {
    color: AppTheme.textMuted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
});
