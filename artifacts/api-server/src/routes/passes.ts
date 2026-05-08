import { Router } from "express";
import { getAdminAuth, getAdminDb } from "../lib/admin.js";

const router = Router();

router.post("/passes/create", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header." });
    return;
  }

  const idToken = authHeader.slice("Bearer ".length);
  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    res.status(401).json({ error: "Invalid Firebase ID token." });
    return;
  }

  const { studentId, studentName, originTeacherId, destinationTeacherId, destinationRoom } =
    req.body as {
      studentId?: string;
      studentName?: string;
      originTeacherId?: string;
      destinationTeacherId?: string;
      destinationRoom?: string;
    };

  if (!studentId || !studentName || !originTeacherId || !destinationTeacherId) {
    res.status(400).json({ error: "Missing required pass fields." });
    return;
  }

  if (uid !== destinationTeacherId) {
    res.status(403).json({ error: "You may only create passes for your own room." });
    return;
  }

  const db = getAdminDb();

  try {
    const [collisionSnap, studentDoc, teacherDoc] = await Promise.all([
      db
        .collection("passes")
        .where("studentId", "==", studentId)
        .where("status", "in", ["pending", "in_transit"])
        .get(),
      db.collection("students").doc(studentId).get(),
      db.collection("users").doc(destinationTeacherId).get(),
    ]);

    if (!collisionSnap.empty) {
      res.status(409).json({
        code: "COLLISION",
        error:
          "This student already has an active pass and cannot be requested again until it is completed.",
      });
      return;
    }

    if (studentDoc.exists && studentDoc.data()?.isAbsent === true) {
      res.status(422).json({
        code: "ABSENT",
        error: `${studentName} has been marked absent today and cannot receive a pass.`,
      });
      return;
    }

    const capacity: number = teacherDoc.data()?.studyHallCapacity ?? 0;
    if (capacity > 0) {
      const activeSnap = await db
        .collection("passes")
        .where("destinationTeacherId", "==", destinationTeacherId)
        .where("status", "in", ["pending", "in_transit"])
        .get();
      if (activeSnap.size >= capacity) {
        res.status(422).json({
          code: "AT_CAPACITY",
          error: `Room is full (${activeSnap.size}/${capacity}). Release a student before accepting more.`,
        });
        return;
      }
    }

    const passRef = await db.collection("passes").add({
      studentId,
      studentName,
      originTeacherId,
      destinationTeacherId,
      destinationRoom: destinationRoom ?? "",
      status: "pending",
      requestedAt: new Date().toISOString(),
    });

    res.status(201).json({ passId: passRef.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create pass.";
    console.error("Pass creation error:", err);
    res.status(500).json({ error: message });
  }
});

export default router;
