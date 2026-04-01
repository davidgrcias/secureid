import { apiClient } from "./api";
import type { AuthUser } from "@/stores/authStore";

type AuthSessionPayload = {
  user: AuthUser;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
};

type ApiResponse<T> = {
  message?: string;
  data: T;
};

export async function login(input: { identifier: string; password: string }): Promise<AuthSessionPayload> {
  const response = await apiClient.post<ApiResponse<AuthSessionPayload>>("/api/auth/login", input);
  return response.data.data;
}

export async function register(input: {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
}): Promise<AuthSessionPayload> {
  const response = await apiClient.post<ApiResponse<AuthSessionPayload>>("/api/auth/register", input);
  return response.data.data;
}

export async function forgotPassword(email: string): Promise<{ resetToken?: string }> {
  const response = await apiClient.post<ApiResponse<{ resetToken?: string }>>("/api/auth/forgot-password", {
    email
  });
  return response.data.data;
}

export async function resetPassword(input: { token: string; password: string }): Promise<void> {
  await apiClient.post("/api/auth/reset-password", input);
}

export async function logout(): Promise<void> {
  await apiClient.post("/api/auth/logout");
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await apiClient.get<ApiResponse<AuthUser>>("/api/users/me");
  return response.data.data;
}
