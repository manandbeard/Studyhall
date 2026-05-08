import { Feather } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import { doc, updateDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/components/AuthProvider";
import { NeoBox, NeoButton, NeoLabel } from "@/components/NeoUI";
import { useColors } from "@/hooks/useColors";
import { db } from "@/lib/firebase";

export default function SettingsScreen() {
  const { user, loading, signOut, refreshUser } = useAuth();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(user?.name ?? "");
  const [roomNumber, setRoomNumber] = useState(user?.roomNumber ?? "");
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? "");
  const [isAway, setIsAway] = useState(user?.isAway ?? false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (loading) return null;
  if (!user) return <Redirect href="/" />;

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    setErrorMsg(null);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        name,
        roomNumber,
        phoneNumber,
        isAway,
      });
      await refreshUser();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

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
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={[
            styles.iconBtn,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Settings
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <NeoBox style={styles.card}>
          <View
            style={[
              styles.cardHeader,
              { backgroundColor: colors.blue, borderBottomColor: colors.border },
            ]}
          >
            <Text style={styles.cardHeaderText}>Profile</Text>
          </View>

          <View style={styles.cardBody}>
            <NeoLabel>Display Name</NeoLabel>
            <TextInput
              style={[
                styles.input,
                { borderColor: colors.border, color: colors.foreground },
              ]}
              value={name}
              onChangeText={setName}
              placeholderTextColor={colors.mutedForeground}
            />

            <View style={{ height: 14 }} />
            <NeoLabel>Room Number</NeoLabel>
            <TextInput
              style={[
                styles.input,
                { borderColor: colors.border, color: colors.foreground },
              ]}
              value={roomNumber}
              onChangeText={setRoomNumber}
              placeholderTextColor={colors.mutedForeground}
            />

            <View style={{ height: 14 }} />
            <NeoLabel>Phone (optional)</NeoLabel>
            <TextInput
              style={[
                styles.input,
                { borderColor: colors.border, color: colors.foreground },
              ]}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              placeholder="(555) 000-0000"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>
        </NeoBox>

        <NeoBox style={styles.card}>
          <View
            style={[
              styles.cardHeader,
              {
                backgroundColor: colors.yellow,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <Text style={styles.cardHeaderText}>Status</Text>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.switchTitle, { color: colors.foreground }]}>
                  Away Mode
                </Text>
                <Text
                  style={[styles.switchSub, { color: colors.mutedForeground }]}
                >
                  Hide me from other teachers' request lists.
                </Text>
              </View>
              <Switch
                value={isAway}
                onValueChange={setIsAway}
                trackColor={{ false: colors.muted, true: colors.red }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        </NeoBox>

        {errorMsg && (
          <View
            style={[
              styles.errorBox,
              { backgroundColor: colors.red, borderColor: colors.border },
            ]}
          >
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}
        {success && (
          <View
            style={[
              styles.successBox,
              { backgroundColor: colors.green, borderColor: colors.border },
            ]}
          >
            <Feather name="check" size={18} color={colors.foreground} />
            <Text style={[styles.successText, { color: colors.foreground }]}>
              Saved
            </Text>
          </View>
        )}

        <NeoButton
          bg={colors.green}
          onPress={handleSave}
          loading={saving}
          size="lg"
          style={{ marginTop: 4 }}
          testID="save-settings"
        >
          Save Settings
        </NeoButton>

        <View style={{ height: 16 }} />
        <NeoButton
          bg={colors.red}
          textColor="#ffffff"
          onPress={signOut}
          size="md"
          testID="sign-out-settings"
        >
          Sign Out
        </NeoButton>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  body: {
    padding: 16,
    gap: 16,
  },
  card: {
    overflow: "hidden",
  },
  cardHeader: {
    padding: 14,
    borderBottomWidth: 4,
  },
  cardHeaderText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#ffffff",
  },
  cardBody: {
    padding: 16,
  },
  input: {
    borderWidth: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    backgroundColor: "#ffffff",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  switchTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  switchSub: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    marginTop: 2,
  },
  errorBox: {
    padding: 12,
    borderWidth: 4,
  },
  errorText: {
    color: "#ffffff",
    fontFamily: "Inter_700Bold",
  },
  successBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    padding: 12,
    borderWidth: 4,
  },
  successText: {
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
