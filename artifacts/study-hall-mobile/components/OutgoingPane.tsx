import * as Haptics from "expo-haptics";
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/components/AuthProvider";
import { NeoBox, NeoButton } from "@/components/NeoUI";
import { useColors } from "@/hooks/useColors";
import { db } from "@/lib/firebase";

interface Pass {
  id: string;
  studentName?: string;
  destinationRoom?: string;
  status?: "pending" | "in_transit" | "arrived" | "completed";
  departedAt?: string;
}

export function OutgoingPane() {
  const { user } = useAuth();
  const colors = useColors();
  const [passes, setPasses] = useState<Pass[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "passes"),
      where("originTeacherId", "==", user.uid),
      where("status", "in", ["pending", "in_transit"]),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPasses(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as Pass),
        );
        setLoading(false);
      },
      (err) => {
        console.error("Outgoing onSnapshot:", err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [user]);

  const handleSend = async (passId: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      await updateDoc(doc(db, "passes", passId), {
        status: "in_transit",
        departedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("handleSend:", err);
    }
  };

  const isOverdue = (departedAt?: string) => {
    if (!departedAt) return false;
    return (now - new Date(departedAt).getTime()) / 60000 >= 5;
  };

  return (
    <NeoBox style={styles.container} shadow={6}>
      <View style={[styles.header, { backgroundColor: colors.yellow }]}>
        <Text style={styles.headerText}>Outgoing — 3rd Period</Text>
      </View>
      <View style={styles.body}>
        {loading ? (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            Loading...
          </Text>
        ) : passes.length === 0 ? (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            No pending requests.
          </Text>
        ) : (
          passes.map((pass) => {
            const overdue =
              pass.status === "in_transit" && isOverdue(pass.departedAt);
            const cardBg =
              pass.status === "pending"
                ? colors.card
                : overdue
                ? colors.red
                : colors.blue;
            const fg = pass.status === "pending" ? colors.foreground : "#fff";
            return (
              <View
                key={pass.id}
                style={[styles.passCard, { backgroundColor: cardBg }]}
              >
                <View style={styles.passInfo}>
                  <Text style={[styles.passName, { color: fg }]}>
                    {pass.studentName ?? "Unknown"}
                  </Text>
                  <Text style={[styles.passSub, { color: fg }]}>
                    To: Room {pass.destinationRoom ?? "?"}
                  </Text>
                </View>
                {pass.status === "pending" ? (
                  <NeoButton
                    bg={colors.green}
                    size="sm"
                    onPress={() => handleSend(pass.id)}
                    testID={`send-${pass.id}`}
                  >
                    Send
                  </NeoButton>
                ) : (
                  <Text style={[styles.statusTag, { color: fg }]}>
                    {overdue ? "Overdue" : "In Transit"}
                  </Text>
                )}
              </View>
            );
          })
        )}
      </View>
    </NeoBox>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  header: {
    borderBottomWidth: 4,
    borderBottomColor: "#111111",
    padding: 14,
  },
  headerText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#111111",
  },
  body: { padding: 14, gap: 10 },
  empty: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    paddingVertical: 12,
  },
  passCard: {
    borderWidth: 4,
    borderColor: "#111111",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  passInfo: { flex: 1 },
  passName: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  passSub: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    marginTop: 2,
  },
  statusTag: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
