import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@/components/AuthProvider";
import { NeoBox, NeoButton, NeoLabel } from "@/components/NeoUI";
import { useColors } from "@/hooks/useColors";
import { db } from "@/lib/firebase";

interface Pass {
  id: string;
  studentName?: string;
  status?: "pending" | "in_transit" | "arrived" | "completed";
}

interface Student {
  id: string;
  name: string;
  thirdPeriodTeacherId?: string;
}

interface Teacher {
  id: string;
  name: string;
  roomNumber?: string;
  isAway?: boolean;
}

export function IncomingPane() {
  const { user } = useAuth();
  const colors = useColors();
  const [passes, setPasses] = useState<Pass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestOpen, setRequestOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedOriginId, setSelectedOriginId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const qPasses = query(
      collection(db, "passes"),
      where("destinationTeacherId", "==", user.uid),
      where("status", "in", ["pending", "in_transit", "arrived"]),
    );
    const unsubPasses = onSnapshot(qPasses, (snap) => {
      setPasses(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as Pass),
      );
      setLoading(false);
    });

    const unsubStudents = onSnapshot(collection(db, "students"), (snap) => {
      const list = snap.docs.map(
        (d) => ({ id: d.id, ...(d.data() as object) }) as Student,
      );
      list.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
      setStudents(list);
    });

    const qTeachers = query(
      collection(db, "users"),
      where("role", "==", "teacher"),
    );
    const unsubTeachers = onSnapshot(qTeachers, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as object) }) as Teacher)
        .filter((t) => !t.isAway);
      list.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
      setTeachers(list);
    });

    return () => {
      unsubPasses();
      unsubStudents();
      unsubTeachers();
    };
  }, [user]);

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students.slice(0, 30);
    const term = studentSearch.toLowerCase();
    return students
      .filter((s) => (s.name ?? "").toLowerCase().includes(term))
      .slice(0, 30);
  }, [students, studentSearch]);

  const resetForm = () => {
    setStudentSearch("");
    setSelectedStudentId("");
    setSelectedOriginId("");
    setSubmitError(null);
  };

  const handleReceive = async (passId: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      await updateDoc(doc(db, "passes", passId), {
        status: "arrived",
        arrivedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("handleReceive:", err);
    }
  };

  const handleComplete = async (passId: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      await updateDoc(doc(db, "passes", passId), {
        status: "completed",
        completedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("handleComplete:", err);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    const name = studentSearch.trim();
    if (!name || !selectedOriginId) {
      setSubmitError("Pick a student and origin teacher.");
      return;
    }
    const origin = teachers.find((t) => t.id === selectedOriginId);
    if (!origin) {
      setSubmitError("Origin teacher not found.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      let studentId = selectedStudentId;
      let studentName = name;
      if (!studentId) {
        const existing = students.find(
          (s) => (s.name ?? "").toLowerCase() === name.toLowerCase(),
        );
        if (existing) {
          studentId = existing.id;
          studentName = existing.name;
        } else {
          const ref = await addDoc(collection(db, "students"), {
            name: studentName,
            thirdPeriodTeacherId: origin.id,
            notes: "Created via mobile pass request",
            isAbsent: false,
          });
          studentId = ref.id;
        }
      } else {
        const s = students.find((x) => x.id === studentId);
        if (s) studentName = s.name;
      }

      await addDoc(collection(db, "passes"), {
        studentId,
        studentName,
        originTeacherId: origin.id,
        destinationTeacherId: user.uid,
        destinationRoom: user.roomNumber ?? "TBD",
        status: "pending",
        requestedAt: new Date().toISOString(),
      });
      resetForm();
      setRequestOpen(false);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      console.error("handleSubmit:", err);
      setSubmitError(err instanceof Error ? err.message : "Failed to request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <NeoBox style={styles.container} shadow={6}>
      <View style={[styles.header, { backgroundColor: colors.blue }]}>
        <Text style={styles.headerText}>Incoming — Destination</Text>
        <Pressable
          onPress={() => setRequestOpen(true)}
          style={[
            styles.requestBtn,
            { backgroundColor: colors.yellow, borderColor: colors.border },
          ]}
        >
          <Feather name="plus" size={16} color={colors.foreground} />
          <Text style={[styles.requestBtnText, { color: colors.foreground }]}>
            Request
          </Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        {loading ? (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            Loading...
          </Text>
        ) : passes.length === 0 ? (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            No incoming students.
          </Text>
        ) : (
          passes.map((pass) => {
            const cardBg =
              pass.status === "in_transit"
                ? colors.yellow
                : pass.status === "arrived"
                ? colors.green
                : colors.card;
            return (
              <View
                key={pass.id}
                style={[styles.passCard, { backgroundColor: cardBg }]}
              >
                <View style={styles.passInfo}>
                  <Text style={[styles.passName, { color: colors.foreground }]}>
                    {pass.studentName ?? "Unknown"}
                  </Text>
                  <Text
                    style={[styles.passSub, { color: colors.foreground }]}
                  >
                    Status: {(pass.status ?? "").replace("_", " ").toUpperCase()}
                  </Text>
                </View>
                {pass.status === "in_transit" ? (
                  <NeoButton
                    bg={colors.green}
                    size="sm"
                    onPress={() => handleReceive(pass.id)}
                    testID={`receive-${pass.id}`}
                  >
                    Received
                  </NeoButton>
                ) : pass.status === "arrived" ? (
                  <NeoButton
                    bg={colors.foreground}
                    textColor="#fff"
                    size="sm"
                    onPress={() => handleComplete(pass.id)}
                    testID={`complete-${pass.id}`}
                  >
                    Done
                  </NeoButton>
                ) : null}
              </View>
            );
          })
        )}
      </View>

      <Modal
        visible={requestOpen}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setRequestOpen(false)}
      >
        <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Request Student
            </Text>
            <Pressable onPress={() => setRequestOpen(false)} hitSlop={12}>
              <Feather name="x" size={24} color={colors.foreground} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.modalBody}
            keyboardShouldPersistTaps="handled"
          >
            <NeoLabel>1. Student Name</NeoLabel>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  color: colors.foreground,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Type or pick a student..."
              placeholderTextColor={colors.mutedForeground}
              value={studentSearch}
              onChangeText={(t) => {
                setStudentSearch(t);
                setSelectedStudentId("");
                setSelectedOriginId("");
              }}
              autoCapitalize="words"
            />
            {studentSearch.length > 0 && (
              <View
                style={[styles.suggestions, { borderColor: colors.border }]}
              >
                {filteredStudents.length === 0 ? (
                  <Text
                    style={[
                      styles.suggestEmpty,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    New student will be created.
                  </Text>
                ) : (
                  filteredStudents.map((s) => (
                    <Pressable
                      key={s.id}
                      style={[
                        styles.suggestRow,
                        { borderBottomColor: colors.border },
                      ]}
                      onPress={() => {
                        setSelectedStudentId(s.id);
                        setStudentSearch(s.name);
                        if (s.thirdPeriodTeacherId) {
                          setSelectedOriginId(s.thirdPeriodTeacherId);
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.suggestText,
                          { color: colors.foreground },
                        ]}
                      >
                        {s.name}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            )}

            <View style={{ height: 16 }} />
            <NeoLabel>2. Coming From (3rd Period Teacher)</NeoLabel>
            <View
              style={[
                styles.teacherList,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}
            >
              {teachers.length === 0 ? (
                <Text
                  style={[
                    styles.suggestEmpty,
                    { color: colors.mutedForeground },
                  ]}
                >
                  No teachers available.
                </Text>
              ) : (
                teachers.map((t) => (
                  <Pressable
                    key={t.id}
                    style={[
                      styles.teacherRow,
                      {
                        borderBottomColor: colors.border,
                        backgroundColor:
                          selectedOriginId === t.id
                            ? colors.yellow
                            : "transparent",
                      },
                    ]}
                    onPress={() => setSelectedOriginId(t.id)}
                  >
                    <Text
                      style={[
                        styles.teacherName,
                        { color: colors.foreground },
                      ]}
                    >
                      {t.name}
                    </Text>
                    <Text
                      style={[
                        styles.teacherRoom,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      Room {t.roomNumber ?? "?"}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>

            {submitError && (
              <View
                style={[
                  styles.errorBox,
                  { backgroundColor: colors.red, borderColor: colors.border },
                ]}
              >
                <Text style={styles.errorText}>{submitError}</Text>
              </View>
            )}

            <View style={{ height: 24 }} />
            <NeoButton
              bg={colors.green}
              onPress={handleSubmit}
              loading={submitting}
              size="lg"
            >
              Send Request
            </NeoButton>
          </ScrollView>
        </View>
      </Modal>
    </NeoBox>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  header: {
    borderBottomWidth: 4,
    borderBottomColor: "#111111",
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#ffffff",
  },
  requestBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  requestBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
  modalRoot: { flex: 1 },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 4,
    borderBottomColor: "#111111",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  modalBody: { padding: 20 },
  input: {
    borderWidth: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  suggestions: {
    borderWidth: 4,
    borderTopWidth: 0,
    maxHeight: 180,
    backgroundColor: "#fff",
  },
  suggestRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 2,
  },
  suggestEmpty: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    padding: 12,
  },
  suggestText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  teacherList: {
    borderWidth: 4,
    maxHeight: 240,
  },
  teacherRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  teacherName: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  teacherRoom: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  errorBox: {
    marginTop: 16,
    padding: 12,
    borderWidth: 4,
  },
  errorText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
  },
});
