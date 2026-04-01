"use client";

import { useMemo, useState } from "react";
import { Bell, Menu, MoonStar, Search, Sun } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/hooks/useNotifications";
import { markAllNotificationsAsRead, markNotificationAsRead } from "@/lib/notifications";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useUiStore } from "@/stores/uiStore";

type TopNavProps = {
  variant?: "public" | "dashboard";
  onMenuClick?: () => void;
};

const publicMenu = [
  { label: "Beranda", href: "/" },
  { label: "Produk", href: "/" },
  { label: "Solusi", href: "/" },
  { label: "Harga", href: "/pricing" }
];

export default function TopNav({ variant = "public", onMenuClick }: TopNavProps) {
  useNotifications();

  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);

  const notifications = useNotificationStore((state) => state.items);
  const markAsReadInStore = useNotificationStore((state) => state.markAsRead);
  const markAllAsReadInStore = useNotificationStore((state) => state.markAllAsRead);
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = useMemo(
    () => notifications.reduce((count, notification) => (notification.isRead ? count : count + 1), 0),
    [notifications]
  );

  const initials = (user?.fullName ?? "SecureID")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  async function handleReadNotification(notificationId: string, actionUrl?: string | null): Promise<void> {
    try {
      await markNotificationAsRead(notificationId);
      markAsReadInStore(notificationId);
    } catch {
      // Keep UI responsive even if API is temporarily unavailable.
    }

    if (actionUrl) {
      if (actionUrl.startsWith("/")) {
        router.push(actionUrl);
      } else {
        window.location.href = actionUrl;
      }
    }
  }

  async function handleReadAllNotifications(): Promise<void> {
    try {
      await markAllNotificationsAsRead();
      markAllAsReadInStore();
    } catch {
      // Ignore transient errors in notification control.
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-outline-variant/20 bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-8">
          {variant === "dashboard" ? (
            <button
              type="button"
              onClick={onMenuClick}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface hover:bg-surface-container"
              aria-label="Toggle menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          ) : null}
          <Link href="/" className="text-xl font-black tracking-tight text-on-surface">
            SecureID
          </Link>
          {variant === "public" ? (
            <nav className="hidden items-center gap-2 md:flex">
              {publicMenu.map((item, index) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors ${
                    index === 0
                      ? "text-primary"
                      : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          {variant === "dashboard" ? (
            <label className="hidden items-center gap-2 rounded-full bg-surface-container-low px-3 py-2 text-sm text-on-surface-variant lg:flex">
              <Search className="h-4 w-4" />
              <input
                placeholder="Cari dokumen..."
                className="w-56 border-none bg-transparent text-sm text-on-surface outline-none"
              />
            </label>
          ) : null}

          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
          </button>

          {variant === "dashboard" ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications((value) => !value)}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container"
                aria-label="Notifikasi"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 ? (
                  <span className="absolute right-2 top-2 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-on-primary">
                    {unreadCount}
                  </span>
                ) : null}
              </button>

              {showNotifications ? (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-3 shadow-[0_18px_40px_rgba(17,28,42,0.2)]">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-bold text-on-surface">Notifikasi</p>
                    <button
                      type="button"
                      onClick={handleReadAllNotifications}
                      className="text-xs font-semibold text-primary"
                    >
                      Tandai semua dibaca
                    </button>
                  </div>

                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {notifications.length === 0 ? (
                      <p className="rounded-xl bg-surface-container px-3 py-4 text-center text-xs text-on-surface-variant">
                        Belum ada notifikasi.
                      </p>
                    ) : (
                      notifications.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          onClick={() => handleReadNotification(notification.id, notification.actionUrl)}
                          className={`w-full rounded-xl p-3 text-left ${
                            notification.isRead ? "bg-surface-container" : "bg-primary/10"
                          }`}
                        >
                          <p className="text-xs font-bold text-on-surface">{notification.title}</p>
                          <p className="mt-1 text-xs text-on-surface-variant">{notification.body}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
