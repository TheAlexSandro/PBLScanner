import { MaterialIcons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { AppTheme, onColorFor } from "../theme";
import type { IconName } from "./icons";

type Props = {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  color?: string;
};

export function FilledButton({
  label,
  onPress,
  icon,
  loading = false,
  disabled = false,
  color = AppTheme.primary,
}: Props) {
  const fg = onColorFor(color);
  const inactive = disabled || loading || !onPress;

  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: color,
          opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : icon ? (
        <MaterialIcons name={icon} size={22} color={fg} />
      ) : null}
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 56,
    alignSelf: "stretch",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  label: { fontSize: 16, fontWeight: "600" },
});
