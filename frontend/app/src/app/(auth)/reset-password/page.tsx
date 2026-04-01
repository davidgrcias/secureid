"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { resetPassword } from "@/lib/auth";

const resetSchema = z
  .object({
    password: z.string().min(8, "Kata sandi minimal 8 karakter."),
    confirmPassword: z.string().min(8, "Konfirmasi kata sandi minimal 8 karakter.")
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Konfirmasi kata sandi tidak cocok.",
    path: ["confirmPassword"]
  });

type ResetFormValues = z.infer<typeof resetSchema>;

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { message?: string } | undefined)?.message ?? "Gagal mereset kata sandi.";
  }

  return "Terjadi kesalahan saat mereset kata sandi.";
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [requestError, setRequestError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema)
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!token) {
      setRequestError("Token reset tidak ditemukan.");
      return;
    }

    try {
      setRequestError(null);
      setSuccessMessage(null);
      await resetPassword({ token, password: values.password });
      setSuccessMessage("Kata sandi berhasil diperbarui. Silakan login dengan kata sandi baru.");
    } catch (error) {
      setRequestError(getErrorMessage(error));
    }
  });

  return (
    <section className="mx-auto w-full max-w-lg rounded-3xl bg-surface-container-lowest p-8 shadow-[0_20px_60px_rgba(17,28,42,0.08)]">
      <h1 className="text-4xl font-black tracking-tight text-on-surface">Buat Kata Sandi Baru</h1>
      <p className="mt-2 text-sm text-on-surface-variant">Masukkan kata sandi baru untuk akun SecureID Anda.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Kata Sandi Baru</label>
          <input
            type="password"
            {...register("password")}
            className="w-full rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none ring-2 ring-transparent focus:ring-primary/40"
            placeholder="Minimal 8 karakter"
          />
          {errors.password ? <p className="mt-2 text-xs text-error">{errors.password.message}</p> : null}
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Konfirmasi Kata Sandi</label>
          <input
            type="password"
            {...register("confirmPassword")}
            className="w-full rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none ring-2 ring-transparent focus:ring-primary/40"
            placeholder="Ulangi kata sandi"
          />
          {errors.confirmPassword ? <p className="mt-2 text-xs text-error">{errors.confirmPassword.message}</p> : null}
        </div>

        {requestError ? <p className="rounded-xl bg-error-container px-4 py-3 text-sm text-error">{requestError}</p> : null}
        {successMessage ? <p className="rounded-xl bg-secondary/10 px-4 py-3 text-sm text-secondary">{successMessage}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting || !token}
          className="w-full rounded-xl bg-gradient-to-r from-primary to-primary-container px-4 py-3 text-sm font-bold text-on-primary shadow-[0_12px_30px_rgba(0,61,155,0.3)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
        </button>
      </form>

      <p className="mt-6 text-sm text-on-surface-variant">
        Kembali ke{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          halaman login
        </Link>
      </p>
    </section>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <section className="mx-auto w-full max-w-lg rounded-3xl bg-surface-container-lowest p-8 shadow-[0_20px_60px_rgba(17,28,42,0.08)]">
          <p className="text-sm text-on-surface-variant">Memuat data reset password...</p>
        </section>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
