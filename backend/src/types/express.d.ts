declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        sessionId: string;
        type: "access";
        iat: number;
        exp: number;
      };
      org?: {
        orgId: string;
        role: string;
      };
    }
  }
}

export {};
