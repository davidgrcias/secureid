"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { useAuthStore } from "@/stores/authStore";

type AuthGuardProps = {
  children: React.ReactNode;
};

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const clearSession = useAuthStore((state) => state.clearSession);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!accessToken) {
      router.replace("/login");
      return;
    }

    if (!user) {
      getCurrentUser()
        .then((profile) => {
          setUser(profile);
        })
        .catch(() => {
          clearSession();
          router.replace("/login");
        });
    }
  }, [accessToken, clearSession, isHydrated, router, setUser, user]);

  if (!isHydrated) {
    return (
      <div className="flex min-h-[calc(100dvh-64px)] items-center justify-center text-sm text-on-surface-variant">
        Memuat sesi...
      </div>
    );
  }

  if (!accessToken) {
    return null;
  }

  return <>{children}</>;
}
