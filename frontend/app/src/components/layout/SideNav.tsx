"use client";

import { FileText, HelpCircle, Home, Send, ShieldCheck, UserRound, Users2, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { logout } from "@/lib/auth";
import { useAuthStore } from "@/stores/authStore";

type SideNavProps = {
  open: boolean;
  onClose: () => void;
};

const menuItems = [
  { label: "Beranda", href: "/dashboard", icon: Home },
  { label: "Dokumen Saya", href: "/dashboard/documents", icon: FileText },
  { label: "Kirim Dokumen", href: "/dashboard/send", icon: Send },
  { label: "Verifikasi Identitas", href: "/dashboard/verify", icon: ShieldCheck },
  { label: "Team Management", href: "/dashboard/team", icon: Users2 },
  { label: "Profil", href: "/dashboard/settings", icon: UserRound }
];

export default function SideNav({ open, onClose }: SideNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);

  async function handleLogout(): Promise<void> {
    try {
      await logout();
    } catch {
      // Session may already be invalid; continue clearing local state.
    }

    clearSession();
    router.replace("/login");
  }

  return (
    <>
      <div
        className={clsx(
          "fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />

      <aside
        className={clsx(
          "fixed left-0 top-0 z-50 flex h-dvh w-72 flex-col border-r border-outline-variant/20 bg-surface-container-low p-4 transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0"
        )}
      >
        <div className="mb-6 flex items-center justify-between px-2 pt-2 lg:pt-16">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.08em] text-primary">SecureID</p>
            <p className="text-xs text-on-surface-variant">{user?.fullName ?? "Verified Member"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-on-surface-variant lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all",
                  active
                    ? "bg-surface-container-lowest text-primary shadow-[0_8px_24px_rgba(17,28,42,0.08)]"
                    : "text-on-surface-variant hover:bg-surface-container"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          className="mt-auto rounded-xl bg-gradient-to-r from-primary to-primary-container px-4 py-3 text-sm font-bold text-on-primary shadow-[0_12px_30px_rgba(0,61,155,0.35)]"
        >
          Mulai Tanda Tangan
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-2 rounded-xl bg-surface-container px-4 py-3 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high"
        >
          Keluar
        </button>

        <div className="mt-6 rounded-xl bg-surface-container p-4">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-primary">Bantuan</p>
          <div className="mt-2 flex items-center gap-2 text-sm text-on-surface-variant">
            <HelpCircle className="h-4 w-4" />
            Help Center
          </div>
        </div>
      </aside>
    </>
  );
}
