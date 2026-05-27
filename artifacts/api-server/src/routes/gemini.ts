import express from "express";

// Instantiated explicitly without abstract type interfaces to keep instance methods intact
const router = express.Router();

// Explicit inline typing on line 25 prevents TS7006 from triggering on Vercel
router.post("/", async (req: any, res: any): Promise<void> => {
  try {
    // 1. Defensively look for payload properties
    const body = req && typeof req.json === "function" ? await req.json() : req?.body;
    
    // Validate that a prompt payload was provided
    if (!body || !body.prompt) {
      if (res && typeof res.status === "function") {
        res.status(400).json({ error: "Missing required 'prompt' parameter in request body." });
      } else if (res && typeof res.writeHead === "function") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing required 'prompt' parameter in request body." }));
      }
      return;
    }

    // --- Place your existing Gemini AI Studio SDK inference logic here ---
    // Example placeholder payload structure:
    const mockAiResponse = {
      message: "AI pipeline connected successfully.",
      inputReceived: body.prompt,
      timestamp: new Date().toISOString()
    };

    // 2. Safe execution return block targeting multiple environments
    if (res && typeof res.status === "function") {
      res.status(200).json(mockAiResponse);
    } else if (res && typeof res.writeHead === "function") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(mockAiResponse));
    }

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : "Internal AI pipeline exception.";
    
    if (res && typeof res.status === "function") {
      res.status(500).json({ error: errorMessage });
    } else if (res && typeof res.writeHead === "function") {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: errorMessage }));
    }
  }
});

export default router;
