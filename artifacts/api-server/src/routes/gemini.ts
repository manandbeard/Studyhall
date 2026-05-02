import { Router } from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp, getApps, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const router = Router();

const ADMIN_EMAIL = "nhelland@nbend.k12.or.us";

let adminApp: App;

function getAdminApp(): App {
  if (!adminApp) {
    if (getApps().length === 0) {
      adminApp = initializeApp({
        projectId: "studentprojector",
      });
    } else {
      adminApp = getApps()[0];
    }
  }
  return adminApp;
}

const requestCounts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string, maxPerMinute = 10): boolean {
  const now = Date.now();
  const entry = requestCounts.get(key);
  if (!entry || now > entry.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (entry.count >= maxPerMinute) return true;
  entry.count++;
  return false;
}

router.post("/gemini/parse-roster", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header." });
    return;
  }

  const idToken = authHeader.slice("Bearer ".length);
  let uid: string;
  let email: string | undefined;
  try {
    const decoded = await getAuth(getAdminApp()).verifyIdToken(idToken);
    uid = decoded.uid;
    email = decoded.email;
  } catch {
    res.status(401).json({ error: "Invalid Firebase ID token." });
    return;
  }

  if (email !== ADMIN_EMAIL) {
    res.status(403).json({ error: "Admin access required." });
    return;
  }

  if (isRateLimited(uid)) {
    res.status(429).json({ error: "Too many requests. Please wait before retrying." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
    return;
  }

  const { csvChunk, lastTeacher } = req.body as { csvChunk?: string; lastTeacher?: string };
  if (!csvChunk) {
    res.status(400).json({ error: "csvChunk is required." });
    return;
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
Parse the following CSV chunk of a school roster.
The previous chunk's last active teacher was: "${lastTeacher ?? ""}". Use this teacher name for students at the beginning of this chunk if no new teacher name is specified before them.
Extract the teachers and their students. For the teacher name, extract just the name (e.g., "Helland" or "Smith, John"), ignoring course names.
CSV Chunk:
${csvChunk}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              teacherName: { type: Type.STRING },
              students: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    destination: { type: Type.STRING },
                    isAbsent: { type: Type.BOOLEAN },
                  },
                  required: ["name", "destination", "isAbsent"],
                },
              },
            },
            required: ["teacherName", "students"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) {
      res.status(500).json({ error: "Empty response from Gemini." });
      return;
    }

    res.json({ data: JSON.parse(text) });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Gemini request failed." });
  }
});

export default router;
