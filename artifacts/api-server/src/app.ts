import type { IncomingMessage, ServerResponse } from "node:http";
import express from "express";
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
import { ErrorRequestHandler } from "express";

// ... your route definitions ...

app.use("/api", router);

// Explicitly bind the ErrorRequestHandler interface to the function wrapper
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  logger.error({ err }, "Unhandled request error");

  // Express types are now fully unlocked natively
  if (res.headersSent) {
    return _next(err); // Pass down the stream if headers are already dispatched
  }

  const message = err instanceof Error ? err.message : "Unexpected server error.";
  const statusCode = err?.status || err?.statusCode || 500;

  res.status(statusCode).json({ error: message });
};

app.use(errorHandler);

export default app;
