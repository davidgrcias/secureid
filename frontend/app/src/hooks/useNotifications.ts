"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import { listNotifications } from "@/lib/notifications";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";

const SOCKET_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function useNotifications(): void {
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.user?.id);

  const setNotifications = useNotificationStore((state) => state.setNotifications);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);

  useEffect(() => {
    if (!accessToken || !userId) {
      setNotifications([]);
      return;
    }

    let isMounted = true;

    listNotifications(30)
      .then((items) => {
        if (isMounted) {
          setNotifications(items);
        }
      })
      .catch(() => {
        if (isMounted) {
          setNotifications([]);
        }
      });

    const socket = io(SOCKET_BASE_URL, {
      auth: {
        token: accessToken
      }
    });

    socket.on("notification:new", (notification) => {
      addNotification(notification);
    });

    socket.on("notification:read", (notification) => {
      markAsRead(notification.id);
    });

    socket.on("notification:all-read", () => {
      markAllAsRead();
    });

    return () => {
      isMounted = false;
      socket.disconnect();
    };
  }, [accessToken, userId, setNotifications, addNotification, markAsRead, markAllAsRead]);
}
