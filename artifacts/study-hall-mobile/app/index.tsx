import { Feather } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/components/AuthProvider";
import { NeoBox, NeoButton } from "@/components/NeoUI";
import { useColors } from "@/hooks/useColors";
import { SCHOOL_DOMAIN } from "@/lib/firebase";

export default function LoginScreen() {
  const { user, loading, signingIn, error, configMissing, signIn } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <View
        style={[styles.center, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator size="large" color={colors.foreground} />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/dashboard" />;
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View style={styles.spacer} />

      <View style={styles.titleBlock}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Study Hall
        </Text>
        <View style={[styles.titleAccent, { backgroundColor: colors.yellow }]}>
          <Text style={[styles.subtitle, { color: colors.foreground }]}>
            Tracker
          </Text>
        </View>
      </View>

      <NeoBox style={styles.card} shadow={8}>
        <Text style={[styles.tagline, { color: colors.foreground }]}>
          Real-time student transit{`\n`}from your back pocket.
        </Text>

        {error && (
          <View
            style={[
              styles.errorBox,
              {
                backgroundColor: colors.red,
                borderColor: colors.border,
              },
            ]}
          >
            <Feather name="alert-triangle" size={16} color="#fff" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {configMissing && (
          <View
            style={[
              styles.configBox,
              {
                backgroundColor: colors.yellow,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.configTitle, { color: colors.foreground }]}>
              Setup Required
            </Text>
            <Text style={[styles.configBody, { color: colors.foreground }]}>
              Add Google OAuth client IDs to your Replit Secrets:
              {`\n`}• EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
              {`\n`}• EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
              {`\n`}• EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
            </Text>
          </View>
        )}

        <NeoButton
          bg={colors.blue}
          textColor="#ffffff"
          onPress={signIn}
          loading={signingIn}
          size="lg"
          style={styles.signInBtn}
          testID="sign-in-google"
        >
          Sign in with Google
        </NeoButton>

        <Text style={[styles.domain, { color: colors.mutedForeground }]}>
          School accounts only — @{SCHOOL_DOMAIN}
        </Text>
      </NeoBox>

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    alignItems: "stretch",
    gap: 24,
  },
  spacer: { flex: 1 },
  titleBlock: { alignItems: "center" },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 48,
    textTransform: "uppercase",
    letterSpacing: -1,
    textAlign: "center",
  },
  titleAccent: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginTop: 4,
  },
  subtitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  card: {
    padding: 24,
    gap: 20,
    alignItems: "stretch",
  },
  tagline: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderWidth: 4,
  },
  errorText: {
    flex: 1,
    color: "#ffffff",
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  configBox: {
    padding: 12,
    borderWidth: 4,
  },
  configTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  configBody: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    lineHeight: 18,
  },
  signInBtn: { width: "100%" },
  domain: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textAlign: "center",
  },
});
