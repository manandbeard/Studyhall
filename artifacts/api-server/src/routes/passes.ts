import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "../lib/admin.js";

const router = Router();

class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

async function verifyToken(authHeader: string | undefined): Promise<string> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError("UNAUTHORIZED", "Missing or invalid Authorization header.", 401);
  }
  try {
    const decoded = await getAdminAuth().verifyIdToken(authHeader.slice("Bearer ".length));
    return decoded.uid;
  } catch {
    throw new AppError("UNAUTHORIZED", "Invalid Firebase ID token.", 401);
  }
}

router.post("/passes/create", async (req, res) => {
  let uid: string;
  try {
    uid = await verifyToken(req.headers.authorization);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.status).json({ code: err.code, error: err.message });
    } else {
      res.status(500).json({ error: "Unexpected auth error." });
    }
    return;
  }

  const {
    studentId,
    studentName,
    originTeacherId,
    destinationTeacherId,
    destinationRoom,
  } = req.body as {
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
  const newPassRef = db.collection("passes").doc();
  const lockRef = db.collection("activeStudentPasses").doc(studentId);
  const counterRef = db.collection("teacherActiveCount").doc(destinationTeacherId);
  const teacherRef = db.collection("users").doc(destinationTeacherId);
  const studentRef = db.collection("students").doc(studentId);

  try {
    await db.runTransaction(async (tx) => {
      const [lockDoc, counterDoc, teacherDoc, studentDoc] = await Promise.all([
        tx.get(lockRef),
        tx.get(counterRef),
        tx.get(teacherRef),
        tx.get(studentRef),
      ]);

      if (lockDoc.exists) {
        throw new AppError(
          "COLLISION",
          "This student already has an active pass and cannot be requested again until it is completed.",
          409,
        );
      }

      if (studentDoc.exists && studentDoc.data()?.isAbsent === true) {
        throw new AppError(
          "ABSENT",
          `${studentName} has been marked absent today and cannot receive a pass.`,
          422,
        );
      }

      const capacity: number = teacherDoc.data()?.studyHallCapacity ?? 0;
      const currentCount: number = counterDoc.exists ? (counterDoc.data()?.count ?? 0) : 0;

      if (capacity > 0 && currentCount >= capacity) {
        throw new AppError(
          "AT_CAPACITY",
          `Room is full (${currentCount}/${capacity}). Release a student before accepting more.`,
          422,
        );
      }

      const now = new Date().toISOString();

      tx.set(lockRef, {
        passId: newPassRef.id,
        studentId,
        destinationTeacherId,
        createdAt: now,
      });

      tx.set(newPassRef, {
        studentId,
        studentName,
        originTeacherId,
        destinationTeacherId,
        destinationRoom: destinationRoom ?? "",
        status: "pending",
        requestedAt: now,
      });

      tx.set(counterRef, { count: currentCount + 1 }, { merge: true });
    });

    res.status(201).json({ passId: newPassRef.id });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.status).json({ code: err.code, error: err.message });
    } else {
      const message = err instanceof Error ? err.message : "Failed to create pass.";
      console.error("Pass creation transaction error:", err);
      res.status(500).json({ error: message });
    }
  }
});

router.post("/passes/:passId/complete", async (req, res) => {
  let uid: string;
  try {
    uid = await verifyToken(req.headers.authorization);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.status).json({ code: err.code, error: err.message });
    } else {
      res.status(500).json({ error: "Unexpected auth error." });
    }
    return;
  }

  const { passId } = req.params;
  const db = getAdminDb();

  try {
    const passRef = db.collection("passes").doc(passId);

    await db.runTransaction(async (tx) => {
      const passDoc = await tx.get(passRef);

      if (!passDoc.exists) {
        throw new AppError("NOT_FOUND", "Pass not found.", 404);
      }

      const data = passDoc.data()!;

      if (data.status === "completed") {
        return;
      }

      if (data.destinationTeacherId !== uid) {
        throw new AppError("FORBIDDEN", "You may only complete passes for your own room.", 403);
      }

      const counterRef = db.collection("teacherActiveCount").doc(data.destinationTeacherId ?? uid);
      const counterDoc = await tx.get(counterRef);

      const now = new Date().toISOString();
      tx.update(passRef, { status: "completed", completedAt: now });

      if (data.studentId) {
        const lockRef = db.collection("activeStudentPasses").doc(data.studentId);
        tx.delete(lockRef);
      }

      if (counterDoc.exists) {
        const current: number = counterDoc.data()?.count ?? 0;
        tx.set(counterRef, { count: Math.max(0, current - 1) }, { merge: true });
      }
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.status).json({ code: err.code, error: err.message });
    } else {
      const message = err instanceof Error ? err.message : "Failed to complete pass.";
      console.error("Pass complete transaction error:", err);
      res.status(500).json({ error: message });
    }
  }
});

export default router;
