import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

import { useColors } from "@/hooks/useColors";

const BORDER = "#111111";

interface NeoBoxProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  shadow?: number;
  bg?: string;
}

export function NeoBox({ children, style, shadow = 6, bg }: NeoBoxProps) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: bg ?? colors.card,
          shadowOffset: { width: shadow, height: shadow },
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

interface NeoButtonProps {
  onPress?: () => void;
  children?: React.ReactNode;
  bg?: string;
  textColor?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle;
  size?: "sm" | "md" | "lg";
  testID?: string;
}

export function NeoButton({
  onPress,
  children,
  bg,
  textColor,
  disabled,
  loading,
  style,
  textStyle,
  size = "md",
  testID,
}: NeoButtonProps) {
  const colors = useColors();
  const sizeStyle = sizeStyles[size];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        sizeStyle.container,
        {
          backgroundColor: bg ?? colors.yellow,
          opacity: disabled ? 0.5 : 1,
          shadowOffset: pressed
            ? { width: 0, height: 0 }
            : { width: 4, height: 4 },
          transform: [
            { translateX: pressed ? 4 : 0 },
            { translateY: pressed ? 4 : 0 },
          ],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor ?? colors.foreground} />
      ) : typeof children === "string" ? (
        <Text
          style={[
            styles.buttonText,
            sizeStyle.text,
            { color: textColor ?? colors.foreground },
            textStyle,
          ]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

interface NeoBadgeProps {
  children: React.ReactNode;
  bg?: string;
  textColor?: string;
  pulse?: boolean;
}

export function NeoBadge({ children, bg, textColor }: NeoBadgeProps) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg ?? colors.yellow },
      ]}
    >
      <Text style={[styles.badgeText, { color: textColor ?? colors.foreground }]}>
        {children}
      </Text>
    </View>
  );
}

interface NeoInputLabelProps {
  children: React.ReactNode;
}

export function NeoLabel({ children }: NeoInputLabelProps) {
  const colors = useColors();
  return (
    <Text style={[styles.label, { color: colors.foreground }]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 4,
    borderColor: BORDER,
    shadowColor: BORDER,
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  button: {
    borderWidth: 4,
    borderColor: BORDER,
    shadowColor: BORDER,
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  buttonText: {
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  badge: {
    borderWidth: 2,
    borderColor: BORDER,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  label: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
});

const sizeStyles = {
  sm: StyleSheet.create({
    container: { paddingHorizontal: 12, paddingVertical: 8 },
    text: { fontSize: 12 },
  }),
  md: StyleSheet.create({
    container: { paddingHorizontal: 16, paddingVertical: 12 },
    text: { fontSize: 14 },
  }),
  lg: StyleSheet.create({
    container: { paddingHorizontal: 20, paddingVertical: 16 },
    text: { fontSize: 16 },
  }),
};
