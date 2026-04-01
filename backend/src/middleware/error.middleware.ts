import type { NextFunction, Request, Response } from "express";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function notFoundMiddleware(req: Request, _res: Response, next: NextFunction): void {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      message: err.message,
      details: err.details ?? null
    });
    return;
  }

  if (err instanceof Error) {
    res.status(500).json({
      message: "Internal server error",
      details: process.env.NODE_ENV === "development" ? err.message : null
    });
    return;
  }

  res.status(500).json({
    message: "Internal server error",
    details: null
  });
}
