import { Feather } from "@expo/vector-icons";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/components/AuthProvider";
import { NeoBox } from "@/components/NeoUI";
import { useColors } from "@/hooks/useColors";
import { db } from "@/lib/firebase";

interface PassData {
  status?: string;
  departedAt?: string;
  originTeacherId?: string;
  destinationTeacherId?: string;
}

interface StudentData {
  isAbsent?: boolean;
}

export function AttendanceSummary() {
  const { user } = useAuth();
  const colors = useColors();
  const [rosterCount, setRosterCount] = useState(0);
  const [absentCount, setAbsentCount] = useState(0);
  const [outgoingActiveCount, setOutgoingActiveCount] = useState(0);
  const [incomingArrivedCount, setIncomingArrivedCount] = useState(0);
  const [inTransitPasses, setInTransitPasses] = useState<PassData[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user) return;

    const qStudents = query(
      collection(db, "students"),
      where("thirdPeriodTeacherId", "==", user.uid),
    );
    const unsubStudents = onSnapshot(qStudents, (snap) => {
      const data = snap.docs.map((d) => d.data() as StudentData);
      setRosterCount(data.length);
      setAbsentCount(data.filter((s) => s.isAbsent).length);
    });

    const qOutgoing = query(
      collection(db, "passes"),
      where("originTeacherId", "==", user.uid),
      where("status", "in", ["pending", "in_transit"]),
    );
    const unsubOutgoing = onSnapshot(qOutgoing, (snap) => {
      setOutgoingActiveCount(snap.docs.length);
    });

    const qIncoming = query(
      collection(db, "passes"),
      where("destinationTeacherId", "==", user.uid),
      where("status", "in", ["pending", "in_transit", "arrived"]),
    );
    const unsubIncoming = onSnapshot(qIncoming, (snap) => {
      const arrived = snap.docs
        .map((d) => d.data() as PassData)
        .filter((p) => p.status === "arrived");
      setIncomingArrivedCount(arrived.length);
    });

    const qTardy = query(
      collection(db, "passes"),
      where("status", "==", "in_transit"),
    );
    const unsubTardy = onSnapshot(qTardy, (snap) => {
      const mine = snap.docs
        .map((d) => d.data() as PassData)
        .filter(
          (p) =>
            (p.originTeacherId === user.uid ||
              p.destinationTeacherId === user.uid) &&
            !!p.departedAt,
        );
      setInTransitPasses(mine);
    });

    return () => {
      unsubStudents();
      unsubOutgoing();
      unsubIncoming();
      unsubTardy();
    };
  }, [user]);

  const tardyCount = inTransitPasses.filter(
    (p) =>
      p.departedAt &&
      (currentTime - new Date(p.departedAt).getTime()) / 60000 >= 5,
  ).length;

  const presentCount =
    rosterCount - absentCount - outgoingActiveCount + incomingArrivedCount;

  return (
    <View style={styles.row}>
      <NeoBox bg={colors.green} style={styles.card} shadow={4}>
        <View style={styles.cardHeader}>
          <Feather name="users" size={14} color={colors.foreground} />
          <Text style={[styles.label, { color: colors.foreground }]}>
            Present
          </Text>
        </View>
        <Text style={[styles.number, { color: colors.foreground }]}>
          {presentCount}
        </Text>
      </NeoBox>

      <NeoBox bg={colors.red} style={styles.card} shadow={4}>
        <View style={styles.cardHeader}>
          <Feather name="clock" size={14} color="#ffffff" />
          <Text style={[styles.label, { color: "#ffffff" }]}>Tardy</Text>
        </View>
        <Text style={[styles.number, { color: "#ffffff" }]}>{tardyCount}</Text>
      </NeoBox>

      <NeoBox bg={colors.muted} style={styles.card} shadow={4}>
        <View style={styles.cardHeader}>
          <Feather name="user-x" size={14} color={colors.mutedForeground} />
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Absent
          </Text>
        </View>
        <Text style={[styles.number, { color: colors.mutedForeground }]}>
          {absentCount}
        </Text>
      </NeoBox>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  card: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  label: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  number: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
  },
});
