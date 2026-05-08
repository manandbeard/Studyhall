import { Feather } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/components/AuthProvider";
import { AttendanceSummary } from "@/components/AttendanceSummary";
import { IncomingPane } from "@/components/IncomingPane";
import { NeoBadge } from "@/components/NeoUI";
import { OutgoingPane } from "@/components/OutgoingPane";
import { useColors } from "@/hooks/useColors";

export default function DashboardScreen() {
  const { user, loading, signOut } = useAuth();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"outgoing" | "incoming">("outgoing");

  if (loading) return null;
  if (!user) return <Redirect href="/" />;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 14,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Dashboard
          </Text>
          <Text style={[styles.headerSub, { color: colors.foreground }]}>
            Room {user.roomNumber ?? "TBD"} · {user.name}
          </Text>
          {user.isAway && (
            <View style={{ marginTop: 4 }}>
              <NeoBadge bg={colors.red} textColor="#fff">
                Away
              </NeoBadge>
            </View>
          )}
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push("/settings")}
            hitSlop={10}
            style={[
              styles.iconBtn,
              { borderColor: colors.border, backgroundColor: colors.yellow },
            ]}
            testID="open-settings"
          >
            <Feather name="settings" size={18} color={colors.foreground} />
          </Pressable>
          <Pressable
            onPress={signOut}
            hitSlop={10}
            style={[
              styles.iconBtn,
              { borderColor: colors.border, backgroundColor: colors.red },
            ]}
            testID="sign-out"
          >
            <Feather name="log-out" size={18} color="#ffffff" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <AttendanceSummary />

        <View style={styles.tabsRow}>
          <TabButton
            active={tab === "outgoing"}
            onPress={() => setTab("outgoing")}
            label="Outgoing"
            color={colors.yellow}
          />
          <TabButton
            active={tab === "incoming"}
            onPress={() => setTab("incoming")}
            label="Incoming"
            color={colors.blue}
            activeTextColor="#fff"
          />
        </View>

        {tab === "outgoing" ? <OutgoingPane /> : <IncomingPane />}
      </ScrollView>
    </View>
  );
}

interface TabButtonProps {
  active: boolean;
  onPress: () => void;
  label: string;
  color: string;
  activeTextColor?: string;
}

function TabButton({
  active,
  onPress,
  label,
  color,
  activeTextColor,
}: TabButtonProps) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tabBtn,
        {
          backgroundColor: active ? color : colors.card,
          borderColor: colors.border,
          shadowOffset: active
            ? { width: 0, height: 0 }
            : { width: 3, height: 3 },
          transform: [
            { translateX: active ? 3 : 0 },
            { translateY: active ? 3 : 0 },
          ],
        },
      ]}
    >
      <Text
        style={[
          styles.tabText,
          {
            color: active
              ? activeTextColor ?? colors.foreground
              : colors.foreground,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  headerLeft: { flex: 1 },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  headerSub: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
  },
  scrollContent: {
    padding: 16,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 4,
    alignItems: "center",
    shadowColor: "#111111",
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  tabText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
