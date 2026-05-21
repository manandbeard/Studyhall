import type { IncomingMessage, ServerResponse } from "node:http";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app = express();

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
// CORS: whitelist origins from CORS_ORIGIN (comma-separated list).
// Leave CORS_ORIGIN unset to allow all origins (useful during development behind a proxy).
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

app.use("/api", router);

const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  logger.error({ err }, "Unhandled request error");
  if (res.headersSent) {
    return;
  }

  const message = err instanceof Error ? err.message : "Unexpected server error.";
  res.status(500).json({ error: message });
};

app.use(errorHandler);

export default app;
