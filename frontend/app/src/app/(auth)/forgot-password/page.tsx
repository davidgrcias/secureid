"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { forgotPassword } from "@/lib/auth";

const forgotSchema = z.object({
  email: z.string().email("Format email tidak valid.")
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { message?: string } | undefined)?.message ?? "Gagal memproses permintaan.";
  }

  return "Terjadi kesalahan saat memproses permintaan.";
}

export default function ForgotPasswordPage() {
  const [requestError, setRequestError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema)
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      setRequestError(null);
      const result = await forgotPassword(values.email);
      const devTokenMessage = result.resetToken
        ? ` Token reset (dev): ${result.resetToken}`
        : "";
      setSuccessMessage(`Jika email terdaftar, instruksi reset telah dikirim.${devTokenMessage}`);
    } catch (error) {
      setRequestError(getErrorMessage(error));
    }
  });

  return (
    <section className="mx-auto w-full max-w-lg rounded-3xl bg-surface-container-lowest p-8 shadow-[0_20px_60px_rgba(17,28,42,0.08)]">
      <h1 className="text-4xl font-black tracking-tight text-on-surface">Reset Kata Sandi</h1>
      <p className="mt-2 text-sm text-on-surface-variant">Masukkan email akun Anda untuk membuat kata sandi baru.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Email</label>
          <input
            type="email"
            {...register("email")}
            className="w-full rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none ring-2 ring-transparent focus:ring-primary/40"
            placeholder="budi@kantor.com"
          />
          {errors.email ? <p className="mt-2 text-xs text-error">{errors.email.message}</p> : null}
        </div>

        {requestError ? <p className="rounded-xl bg-error-container px-4 py-3 text-sm text-error">{requestError}</p> : null}
        {successMessage ? (
          <p className="rounded-xl bg-secondary/10 px-4 py-3 text-sm text-secondary">{successMessage}</p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-gradient-to-r from-primary to-primary-container px-4 py-3 text-sm font-bold text-on-primary shadow-[0_12px_30px_rgba(0,61,155,0.3)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Memproses..." : "Kirim Instruksi"}
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
