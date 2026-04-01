import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/stores/authStore";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type RetryableAxiosRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

type RefreshPayload = {
  user: NonNullable<ReturnType<typeof useAuthStore.getState>["user"]>;
  tokens: { accessToken: string; refreshToken: string };
};

let refreshRequest: Promise<RefreshPayload> | null = null;

function getOrCreateRefreshRequest(refreshToken: string): Promise<RefreshPayload> {
  if (!refreshRequest) {
    refreshRequest = axios
      .post(`${API_BASE_URL}/api/auth/refresh`, {
        refreshToken
      })
      .then((response) => response.data.data as RefreshPayload)
      .finally(() => {
        refreshRequest = null;
      });
  }

  return refreshRequest;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryableAxiosRequestConfig | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const shouldTryRefresh =
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/api/auth/refresh");

    if (!shouldTryRefresh) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    const { refreshToken, setSession, clearSession, user } = useAuthStore.getState();

    if (!refreshToken || !user) {
      clearSession();
      return Promise.reject(error);
    }

    try {
      const payload = await getOrCreateRefreshRequest(refreshToken);

      setSession(payload.user, payload.tokens.accessToken, payload.tokens.refreshToken);
      originalRequest.headers.Authorization = `Bearer ${payload.tokens.accessToken}`;

      return apiClient(originalRequest);
    } catch (refreshError) {
      clearSession();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return Promise.reject(refreshError);
    }
  }
);
