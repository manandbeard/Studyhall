import { Router } from "express";
import { getAdminAuth, getAdminDb } from "../lib/admin.js";
import { logger } from "../lib/logger.js";

const router = Router();
const FIRESTORE_BATCH_LIMIT = 450;

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

async function verifyAdmin(authHeader: string | undefined): Promise<string> {
  const uid = await verifyToken(authHeader);
  const userDoc = await getAdminDb().collection("users").doc(uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== "admin") {
    throw new AppError("FORBIDDEN", "Admin privileges are required.", 403);
  }
  return uid;
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
    originRoom,
    destinationTeacherId,
    destinationRoom,
  } = req.body as {
    studentId?: string;
    studentName?: string;
    originTeacherId?: string;
    originRoom?: string;
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
        originRoom: originRoom ?? "",
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
      logger.error({ err }, "Pass creation transaction error");
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
      // If the pass was already completed (e.g. by a mobile direct-write that
      // skipped the server) we still clean up the lock, but skip the status
      // update and counter decrement which would already have happened (or been
      // deliberately skipped by the bypass — cleaning the lock is idempotent).
      const alreadyCompleted = data.status === "completed";

      // Permission check only applies when we still need to transition state.
      if (!alreadyCompleted && data.destinationTeacherId !== uid) {
        throw new AppError("FORBIDDEN", "You may only complete passes for your own room.", 403);
      }

      // Always clean up the lock — idempotent, and fixes the case where a
      // direct client-side write marked the pass completed without removing it.
      if (data.studentId) {
        const lockRef = db.collection("activeStudentPasses").doc(data.studentId);
        tx.delete(lockRef);
      }

      if (!alreadyCompleted) {
        const counterRef = db.collection("teacherActiveCount").doc(
          data.destinationTeacherId ?? uid,
        );
        const counterDoc = await tx.get(counterRef);
        const now = new Date().toISOString();
        tx.update(passRef, { status: "completed", completedAt: now });

        if (counterDoc.exists) {
          const current: number = counterDoc.data()?.count ?? 0;
          tx.set(counterRef, { count: Math.max(0, current - 1) }, { merge: true });
        }
      }
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.status).json({ code: err.code, error: err.message });
    } else {
      const message = err instanceof Error ? err.message : "Failed to complete pass.";
      logger.error({ err }, "Pass complete transaction error");
      res.status(500).json({ error: message });
    }
  }
});

router.post("/admin/archive-day", async (req, res) => {
  let uid: string;
  try {
    uid = await verifyAdmin(req.headers.authorization);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.status).json({ code: err.code, error: err.message });
    } else {
      res.status(500).json({ error: "Unexpected auth error." });
    }
    return;
  }

  const db = getAdminDb();
  try {
    const activeStatuses = ["pending", "in_transit", "arrived"];
    const [passesSnap, studentsSnap, locksSnap, countersSnap] = await Promise.all([
      db.collection("passes").where("status", "in", activeStatuses).get(),
      db.collection("students").where("isAbsent", "==", true).get(),
      db.collection("activeStudentPasses").get(),
      db.collection("teacherActiveCount").get(),
    ]);

    const now = new Date().toISOString();
    const date = now.split("T")[0];
    const totalPasses = passesSnap.size;
    const totalAbsentsCleared = studentsSnap.size;

    const teacherPassCounts: Record<string, number> = {};
    for (const passDoc of passesSnap.docs) {
      const data = passDoc.data();
      if (data.originTeacherId) {
        teacherPassCounts[data.originTeacherId] = (teacherPassCounts[data.originTeacherId] ?? 0) + 1;
      }
      if (data.destinationTeacherId && data.destinationTeacherId !== data.originTeacherId) {
        teacherPassCounts[data.destinationTeacherId] =
          (teacherPassCounts[data.destinationTeacherId] ?? 0) + 1;
      }
    }

    let batch = db.batch();
    let writeCount = 0;

    const flushBatch = async () => {
      if (writeCount === 0) return;
      await batch.commit();
      batch = db.batch();
      writeCount = 0;
    };

    const addToBatch = async (fn: (b: FirebaseFirestore.WriteBatch) => void) => {
      fn(batch);
      writeCount += 1;
      if (writeCount >= FIRESTORE_BATCH_LIMIT) {
        await flushBatch();
      }
    };

    for (const passDoc of passesSnap.docs) {
      await addToBatch((b) =>
        b.update(passDoc.ref, {
          status: "completed",
          completedAt: now,
          archivedBy: "daily_reset",
        }),
      );
    }

    for (const lockDoc of locksSnap.docs) {
      await addToBatch((b) => b.delete(lockDoc.ref));
    }

    for (const counterDoc of countersSnap.docs) {
      await addToBatch((b) => b.set(counterDoc.ref, { count: 0 }));
    }

    for (const studentDoc of studentsSnap.docs) {
      await addToBatch((b) => b.update(studentDoc.ref, { isAbsent: false }));
    }

    await flushBatch();

    await db.collection("dailyArchives").add({
      date,
      archivedAt: now,
      totalPassesArchived: totalPasses,
      totalAbsentsCleared,
      teacherPassCounts,
      archivedBy: uid,
    });

    res.status(200).json({
      ok: true,
      totalPassesArchived: totalPasses,
      totalAbsentsCleared,
      teacherPassCounts,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to archive day.";
    logger.error({ err }, "Archive day/reset error");
    res.status(500).json({ error: message });
  }
});

export default router;
