import { Router } from "express";
import healthRouter from "./health.js";
import geminiRouter from "./gemini.js";
import passesRouter from "./passes.js";

const router = Router();

router.use(healthRouter);
router.use(geminiRouter);
router.use(passesRouter);

export default router;
