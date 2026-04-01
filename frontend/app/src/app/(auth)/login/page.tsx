"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { login } from "@/lib/auth";
import { useAuthStore } from "@/stores/authStore";

const loginSchema = z.object({
  identifier: z.string().min(3, "Masukkan email atau nomor HP."),
  password: z.string().min(8, "Kata sandi minimal 8 karakter.")
});

type LoginFormValues = z.infer<typeof loginSchema>;

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { message?: string } | undefined)?.message ?? "Gagal login.";
  }

  return "Terjadi kesalahan saat login.";
}

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [requestError, setRequestError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      setRequestError(null);
      const payload = await login(values);
      setSession(payload.user, payload.tokens.accessToken, payload.tokens.refreshToken);
      router.push("/dashboard");
    } catch (error) {
      setRequestError(getErrorMessage(error));
    }
  });

  return (
    <section className="mx-auto w-full max-w-lg rounded-3xl bg-surface-container-lowest p-8 shadow-[0_20px_60px_rgba(17,28,42,0.08)]">
      <h1 className="text-4xl font-black tracking-tight text-on-surface">Masuk ke SecureID</h1>
      <p className="mt-2 text-sm text-on-surface-variant">Kelola dokumen digital, verifikasi identitas, dan audit log Anda.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Email atau Nomor HP</label>
          <input
            type="text"
            {...register("identifier")}
            className="w-full rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none ring-2 ring-transparent focus:ring-primary/40"
            placeholder="contoh@email.com"
          />
          {errors.identifier ? <p className="mt-2 text-xs text-error">{errors.identifier.message}</p> : null}
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Kata Sandi</label>
          <input
            type="password"
            {...register("password")}
            className="w-full rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none ring-2 ring-transparent focus:ring-primary/40"
            placeholder="Minimal 8 karakter"
          />
          {errors.password ? <p className="mt-2 text-xs text-error">{errors.password.message}</p> : null}
        </div>

        {requestError ? <p className="rounded-xl bg-error-container px-4 py-3 text-sm text-error">{requestError}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-gradient-to-r from-primary to-primary-container px-4 py-3 text-sm font-bold text-on-primary shadow-[0_12px_30px_rgba(0,61,155,0.3)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Memproses..." : "Masuk"}
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="font-semibold text-primary hover:underline">
          Lupa kata sandi?
        </Link>
        <Link href="/register" className="font-semibold text-primary hover:underline">
          Daftar sekarang
        </Link>
      </div>
    </section>
  );
}
