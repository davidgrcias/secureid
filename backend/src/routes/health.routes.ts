import { Router } from "express";
import { cache } from "../config/redis";

const router = Router();

router.get("/health", async (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "secureid-backend",
    cacheMode: cache.mode,
    timestamp: new Date().toISOString()
  });
});

export default router;
