import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.middleware";
import { authRateLimiter } from "../middleware/rateLimiter.middleware";
import {
  loginUser,
  logoutUser,
  refreshUserToken,
  registerUser,
  requestPasswordReset,
  resetUserPassword
} from "../services/auth.service";
import { ApiError } from "../middleware/error.middleware";
import type { RequestMeta } from "../types";

const router = Router();

const registerSchema = z.object({
  fullName: z.string().min(2, "Nama minimal 2 karakter."),
  email: z.string().email("Format email tidak valid.").transform((value) => value.toLowerCase()),
  phone: z.string().min(8).max(32).optional(),
  password: z.string().min(8, "Password minimal 8 karakter.")
});

const loginSchema = z.object({
  identifier: z.string().min(3, "Email atau nomor HP wajib diisi."),
  password: z.string().min(8, "Password minimal 8 karakter.")
});

const refreshSchema = z.object({
  refreshToken: z.string().min(16, "Refresh token wajib diisi.")
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Format email tidak valid.").transform((value) => value.toLowerCase())
});

const resetPasswordSchema = z.object({
  token: z.string().min(16, "Token reset wajib diisi."),
  password: z.string().min(8, "Password minimal 8 karakter.")
});

function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, "Validasi payload gagal.", parsed.error.flatten().fieldErrors);
  }

  return parsed.data;
}

function getRequestMeta(req: Request): RequestMeta {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];

  return {
    ipAddress: (forwardedIp ?? req.ip ?? null)?.toString().trim() ?? null,
    userAgent: req.get("user-agent") ?? null
  };
}

router.post("/register", authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = parseBody(registerSchema, req.body);
    const result = await registerUser(payload, getRequestMeta(req));

    res.status(201).json({
      message: "Registrasi berhasil.",
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.post("/login", authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = parseBody(loginSchema, req.body);
    const result = await loginUser(payload, getRequestMeta(req));

    res.status(200).json({
      message: "Login berhasil.",
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.post("/refresh", authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = parseBody(refreshSchema, req.body);
    const result = await refreshUserToken(payload.refreshToken);

    res.status(200).json({
      message: "Token berhasil diperbarui.",
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, "Tidak terautentikasi.");
    }

    await logoutUser(req.auth.userId, req.auth.sessionId);

    res.status(200).json({
      message: "Logout berhasil."
    });
  } catch (error) {
    next(error);
  }
});

router.post("/forgot-password", authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = parseBody(forgotPasswordSchema, req.body);
    const result = await requestPasswordReset(payload.email);

    res.status(200).json({
      message: "Jika email terdaftar, link reset akan dikirim.",
      data: result
    });
  } catch (error) {
    next(error);
  }
});

router.post("/reset-password", authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = parseBody(resetPasswordSchema, req.body);
    await resetUserPassword(payload);

    res.status(200).json({
      message: "Password berhasil diperbarui."
    });
  } catch (error) {
    next(error);
  }
});

export default router;
