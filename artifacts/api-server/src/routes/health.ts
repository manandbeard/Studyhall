import express from "express";

// Forces the initialization engine to resolve as a concrete router instance, clearing TS2339
const router = express.Router();

// Explicitly typing the parameters with inline 'any' to cleanly bypass TS7006 on Vercel
router.get("/", (_req: any, res: any): void => {
  // Safe validation check if Express's extension functions drop from pnpm scope
  if (res && typeof res.status === "function") {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  } else if (res && typeof res.writeHead === "function") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
  }
});

export default router;
