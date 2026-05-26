import type { IncomingMessage, ServerResponse } from "node:http";
import express from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app = express();

// 1. Logger Pipeline Initialization
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: IncomingMessage & { id?: string | number | object }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: ServerResponse) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// 2. Parsers & Network Validation
const corsOrigin = process.env.CORS_ORIGIN;
app.use(
  cors(
    corsOrigin
      ? { origin: corsOrigin.split(",").map((s: string) => s.trim()).filter(Boolean) }
      : undefined,
  ),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Routing Engine Entry Point
app.use("/api", router);

// 4. Global Structural Error Request Handler (Bypasses pnpm type-isolation failures)
app.use((err: any, _req: any, res: any, _next: any): void => {
  logger.error({ err }, "Unhandled request error");

  // Prevent connection hanging if headers are already dispatched early
  if (res && "headersSent" in res && (res as any).headersSent) {
    if (typeof _next === "function") {
      _next(err);
    }
    return;
  }

  const message = err instanceof Error ? err.message : "Unexpected server error.";
  const statusCode = err?.status || err?.statusCode || 500;

  // Defensive execution paths matching runtime environments cleanly
  if (res && typeof res.status === "function") {
    res.status(statusCode).json({ error: message });
  } else if (res && typeof res.writeHead === "function") {
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: message }));
  }
});

export default app;
