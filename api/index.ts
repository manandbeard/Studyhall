/**
 * Vercel serverless function entry point.
 *
 * Vercel compiles this file and invokes the exported handler for every
 * request that matches the `/api/(.*)` rewrite in vercel.json.  The
 * Express `app` already handles the full `/api` prefix
 * (via `app.use("/api", router)`) so no extra path stripping is needed.
 */
import app from "../artifacts/api-server/src/app.js";

export default app;
