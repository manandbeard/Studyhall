import { Router, type IRouter } from "express";
import healthRouter from "./health";
import geminiRouter from "./gemini";
import passesRouter from "./passes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(geminiRouter);
router.use(passesRouter);

export default router;
