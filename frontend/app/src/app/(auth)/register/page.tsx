"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { register as registerApi } from "@/lib/auth";
import { useAuthStore } from "@/stores/authStore";

const registerSchema = z
  .object({
    fullName: z.string().min(2, "Nama minimal 2 karakter."),
    email: z.string().email("Format email tidak valid."),
    phone: z.string().min(8, "Nomor HP minimal 8 digit.").optional(),
    password: z.string().min(8, "Kata sandi minimal 8 karakter."),
    confirmPassword: z.string().min(8, "Konfirmasi kata sandi minimal 8 karakter.")
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Konfirmasi kata sandi tidak cocok.",
    path: ["confirmPassword"]
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { message?: string } | undefined)?.message ?? "Gagal registrasi.";
  }

  return "Terjadi kesalahan saat registrasi.";
}

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [requestError, setRequestError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: ""
    }
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      setRequestError(null);
      const payload = await registerApi({
        fullName: values.fullName,
        email: values.email,
        phone: values.phone || undefined,
        password: values.password
      });
      setSession(payload.user, payload.tokens.accessToken, payload.tokens.refreshToken);
      router.push("/dashboard/verify");
    } catch (error) {
      setRequestError(getErrorMessage(error));
    }
  });

  return (
    <section className="mx-auto w-full max-w-2xl rounded-3xl bg-surface-container-lowest p-8 shadow-[0_20px_60px_rgba(17,28,42,0.08)]">
      <h1 className="text-4xl font-black tracking-tight text-on-surface">Buat Akun SecureID</h1>
      <p className="mt-2 text-sm text-on-surface-variant">Aktifkan verifikasi identitas dan mulai proses tanda tangan digital legal.</p>

      <form onSubmit={onSubmit} className="mt-8 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Nama Lengkap Sesuai KTP</label>
          <input
            type="text"
            {...register("fullName")}
            className="w-full rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none ring-2 ring-transparent focus:ring-primary/40"
            placeholder="Contoh: Budi Santoso"
          />
          {errors.fullName ? <p className="mt-2 text-xs text-error">{errors.fullName.message}</p> : null}
        </div>

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

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Nomor HP</label>
          <input
            type="text"
            {...register("phone")}
            className="w-full rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none ring-2 ring-transparent focus:ring-primary/40"
            placeholder="08xxxxxxxxxx"
          />
          {errors.phone ? <p className="mt-2 text-xs text-error">{errors.phone.message}</p> : null}
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

        {requestError ? <p className="sm:col-span-2 rounded-xl bg-error-container px-4 py-3 text-sm text-error">{requestError}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="sm:col-span-2 rounded-xl bg-gradient-to-r from-primary to-primary-container px-4 py-3 text-sm font-bold text-on-primary shadow-[0_12px_30px_rgba(0,61,155,0.3)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Membuat akun..." : "Daftar & Lanjut Verifikasi"}
        </button>
      </form>

      <p className="mt-6 text-sm text-on-surface-variant">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Masuk di sini
        </Link>
      </p>
    </section>
  );
}
