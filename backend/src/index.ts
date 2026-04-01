import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { Server as SocketIOServer } from "socket.io";
import { verifyDatabaseConnection } from "./config/database";
import { env } from "./config/env";
import { cache } from "./config/redis";
import { registerSocketServer } from "./config/socket";
import { ensureUploadDirectory } from "./config/storage";
import { authMiddleware } from "./middleware/auth.middleware";
import { errorMiddleware, notFoundMiddleware } from "./middleware/error.middleware";
import { apiRateLimiter } from "./middleware/rateLimiter.middleware";
import authRoutes from "./routes/auth.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import documentRoutes from "./routes/document.routes";
import envelopeRoutes from "./routes/envelope.routes";
import healthRoutes from "./routes/health.routes";
import notificationRoutes from "./routes/notification.routes";
import signRoutes from "./routes/sign.routes";
import signatureRoutes from "./routes/signature.routes";
import teamRoutes from "./routes/team.routes";
import userRoutes from "./routes/user.routes";
import verificationRoutes from "./routes/verification.routes";
import { verifyAccessToken } from "./utils/token";

async function bootstrap(): Promise<void> {
  ensureUploadDirectory();
  await verifyDatabaseConnection();

  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true
    })
  );
  app.use(morgan("dev"));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(apiRateLimiter);

  if (env.NODE_ENV === "development") {
    app.use("/uploads", express.static(env.UPLOAD_DIR));
  }

  app.get("/", (_req, res) => {
    res.status(200).json({
      message: "SecureID API is running",
      cacheMode: cache.mode
    });
  });

  app.get("/api/protected-check", authMiddleware, (_req, res) => {
    res.status(200).json({ message: "Authenticated" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/documents", documentRoutes);
  app.use("/api/envelopes", envelopeRoutes);
  app.use("/api/signatures", signatureRoutes);
  app.use("/api/sign", signRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/verifications", verificationRoutes);
  app.use("/api/team", teamRoutes);
  app.use("/api", healthRoutes);
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      next(new Error("Token diperlukan."));
      return;
    }

    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("Token tidak valid."));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);
  });

  registerSocketServer(io);

  httpServer.listen(env.PORT, () => {
    console.log(`SecureID backend started on port ${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
