import type { IncomingMessage, ServerResponse } from "node:http";
import express from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { ErrorRequestHandler } from "express";
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
      ? { origin: corsOrigin.split(",").map((s) => s.trim()).filter(Boolean) }
      : undefined,
  ),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Routing Engine Entry Point
app.use("/api", router);

// 4. Global Structural Error Request Handler
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  logger.error({ err }, "Unhandled request error");

  // Prevent connection hanging if headers are dispatched early
  if (res.headersSent) {
    return _next(err);
  }

  const message = err instanceof Error ? err.message : "Unexpected server error.";
  const statusCode = err?.status || err?.statusCode || 500;

  res.status(statusCode).json({ error: message });
};

app.use(errorHandler);

export default app;
