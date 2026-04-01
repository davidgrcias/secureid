"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";

type ApiResponse<T> = {
  data: T;
  message?: string;
};

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);

  const canSave = useMemo(() => {
    if (!user) {
      return false;
    }

    return fullName.trim() !== user.fullName || phone.trim() !== (user.phone ?? "");
  }, [fullName, phone, user]);

  useEffect(() => {
    setFullName(user?.fullName ?? "");
    setPhone(user?.phone ?? "");
  }, [user?.fullName, user?.phone]);

  async function handleSaveProfile(): Promise<void> {
    try {
      setIsSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const response = await apiClient.put<
        ApiResponse<{
          id: string;
          email: string;
          phone: string | null;
          fullName: string;
          role: string;
          kycStatus: string;
        }>
      >("/api/users/me", {
        fullName: fullName.trim(),
        phone: phone.trim() || undefined
      });

      if (user) {
        setUser({
          ...user,
          fullName: response.data.data.fullName,
          phone: response.data.data.phone
        });
      }

      setSuccessMessage(response.data.message ?? "Profil berhasil diperbarui.");
    } catch {
      setErrorMessage("Gagal menyimpan perubahan profil.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="rounded-3xl bg-surface-container-lowest p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-primary">Pengaturan</p>
        <h1 className="mt-3 text-3xl font-black text-on-surface">Profil & Keamanan Akun</h1>
        <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
          Kelola data profil, nomor kontak, dan preferensi tampilan dark/light mode aplikasi.
        </p>
      </header>

      {successMessage ? (
        <p className="rounded-2xl bg-secondary/10 px-4 py-3 text-sm text-secondary">{successMessage}</p>
      ) : null}
      {errorMessage ? <p className="rounded-2xl bg-error-container px-4 py-3 text-sm text-error">{errorMessage}</p> : null}

      <article className="rounded-3xl bg-surface-container-lowest p-5 sm:p-6">
        <h2 className="text-lg font-bold text-on-surface">Informasi Profil</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none"
            placeholder="Nama lengkap"
          />
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none"
            placeholder="Nomor telepon"
          />
        </div>

        <button
          type="button"
          onClick={handleSaveProfile}
          disabled={!canSave || isSaving}
          className="mt-4 rounded-xl bg-gradient-to-r from-primary to-primary-container px-5 py-3 text-sm font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </article>

      <article className="rounded-3xl bg-surface-container-lowest p-5 sm:p-6">
        <h2 className="text-lg font-bold text-on-surface">Tampilan</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Pilih mode antarmuka yang paling nyaman untuk tim Anda.</p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`rounded-xl px-4 py-3 text-sm font-semibold ${
              theme === "light" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface"
            }`}
          >
            Light Mode
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`rounded-xl px-4 py-3 text-sm font-semibold ${
              theme === "dark" ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface"
            }`}
          >
            Dark Mode
          </button>
        </div>
      </article>
    </section>
  );
}
