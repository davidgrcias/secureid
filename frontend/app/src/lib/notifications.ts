import { apiClient } from "./api";

export type NotificationItem = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
};

type ApiResponse<T> = {
  message?: string;
  data: T;
};

export async function listNotifications(limit = 20): Promise<NotificationItem[]> {
  const response = await apiClient.get<ApiResponse<NotificationItem[]>>("/api/notifications", {
    params: { limit }
  });

  return response.data.data;
}

export async function markNotificationAsRead(id: string): Promise<NotificationItem> {
  const response = await apiClient.patch<ApiResponse<NotificationItem>>(`/api/notifications/${id}/read`);
  return response.data.data;
}

export async function markAllNotificationsAsRead(): Promise<void> {
  await apiClient.patch("/api/notifications/read-all");
}
