export type SafeUser = {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  avatarUrl: string | null;
  kycStatus: string;
  role: string;
  orgId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type RequestMeta = {
  ipAddress: string | null;
  userAgent: string | null;
};
