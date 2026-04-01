import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export type JwtBasePayload = {
  userId: string;
  sessionId: string;
  type: "access" | "refresh";
};

export type JwtAccessPayload = JwtBasePayload & {
  type: "access";
  iat: number;
  exp: number;
};

export type JwtRefreshPayload = JwtBasePayload & {
  type: "refresh";
  iat: number;
  exp: number;
};

function signToken(payload: JwtBasePayload, secret: string, expiresIn: string): string {
  const options: SignOptions = { expiresIn: expiresIn as SignOptions["expiresIn"] };
  return jwt.sign(payload, secret, options);
}

export function createAccessToken(userId: string, sessionId: string): string {
  return signToken({ userId, sessionId, type: "access" }, env.JWT_ACCESS_SECRET, env.JWT_ACCESS_EXPIRES_IN);
}

export function createRefreshToken(userId: string, sessionId: string): string {
  return signToken(
    { userId, sessionId, type: "refresh" },
    env.JWT_REFRESH_SECRET,
    env.JWT_REFRESH_EXPIRES_IN
  );
}

export function verifyAccessToken(token: string): JwtAccessPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof decoded === "string" || decoded.type !== "access") {
    throw new Error("Invalid access token");
  }

  return decoded as JwtAccessPayload;
}

export function verifyRefreshToken(token: string): JwtRefreshPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
  if (typeof decoded === "string" || decoded.type !== "refresh") {
    throw new Error("Invalid refresh token");
  }

  return decoded as JwtRefreshPayload;
}
