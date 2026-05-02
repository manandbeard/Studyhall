import { Router } from "express";
import { GoogleGenAI, Type } from "@google/genai";

const router = Router();

const requestCounts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string, maxPerMinute = 10): boolean {
  const now = Date.now();
  const entry = requestCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (entry.count >= maxPerMinute) return true;
  entry.count++;
  return false;
}

router.post("/gemini/parse-roster", async (req, res) => {
  const origin = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim()
    ?? req.socket.remoteAddress
    ?? "unknown";

  if (isRateLimited(origin)) {
    res.status(429).json({ error: "Too many requests. Please wait before retrying." });
    return;
  }

  const authHeader = req.headers["x-internal-token"];
  const expectedToken = process.env.INTERNAL_API_TOKEN;
  if (expectedToken && authHeader !== expectedToken) {
    res.status(401).json({ error: "Unauthorized." });
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

    const parsed = JSON.parse(text);
    res.json({ data: parsed });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Gemini request failed." });
  }
});

export default router;
