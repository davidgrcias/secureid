import { create } from "zustand";
import type { NotificationItem } from "@/lib/notifications";

type NotificationState = {
  items: NotificationItem[];
  setNotifications: (items: NotificationItem[]) => void;
  addNotification: (item: NotificationItem) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
};

export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  setNotifications: (items) => set({ items }),
  addNotification: (item) =>
    set((state) => ({
      items: [item, ...state.items.filter((existing) => existing.id !== item.id)]
    })),
  markAsRead: (notificationId) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item))
    })),
  markAllAsRead: () =>
    set((state) => ({
      items: state.items.map((item) => ({ ...item, isRead: true }))
    }))
}));
