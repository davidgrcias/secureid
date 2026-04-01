import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/token";
import { ApiError } from "./error.middleware";

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(new ApiError(401, "Token akses tidak ditemukan."));
    return;
  }

  const accessToken = authHeader.slice("Bearer ".length).trim();

  try {
    const payload = verifyAccessToken(accessToken);
    req.auth = payload;
    next();
  } catch {
    next(new ApiError(401, "Token akses tidak valid atau kedaluwarsa."));
  }
}
