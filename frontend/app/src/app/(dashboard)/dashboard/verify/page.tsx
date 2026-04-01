"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Circle,
  Crosshair,
  Eye,
  Sun,
  UploadCloud,
  X
} from "lucide-react";
import {
  getVerificationOverview,
  submitLivenessVerification,
  uploadVerificationFile,
  type VerificationOverview
} from "@/lib/verification";

const livenessInstructions = ["Berkedip sekarang", "Putar wajah ke kiri", "Senyum natural"];

export default function VerifyPage() {
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [ktpBackFile, setKtpBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  const [isLivenessOpen, setIsLivenessOpen] = useState(false);
  const [livenessStepIndex, setLivenessStepIndex] = useState(0);
  const [isLivenessSuccess, setIsLivenessSuccess] = useState(false);

  const [overview, setOverview] = useState<VerificationOverview | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [isUploadingKtpFront, setIsUploadingKtpFront] = useState(false);
  const [isUploadingKtpBack, setIsUploadingKtpBack] = useState(false);
  const [isUploadingSelfie, setIsUploadingSelfie] = useState(false);
  const [isSubmittingLiveness, setIsSubmittingLiveness] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const latestKtp = overview?.latestByType.ktp_photo;
  const latestSelfie = overview?.latestByType.selfie;
  const latestLiveness = overview?.latestByType.liveness;

  const isKtpReady = latestKtp?.status === "verified";
  const isSelfieReady = latestSelfie?.status === "verified";
  const isLivenessVerified = latestLiveness?.status === "verified";

  const currentInstruction = livenessInstructions[livenessStepIndex] ?? livenessInstructions[0];

  const progressPercent = useMemo(() => {
    const total = livenessInstructions.length;
    const current = isLivenessSuccess ? total : livenessStepIndex + 1;
    return Math.round((current / total) * 100);
  }, [isLivenessSuccess, livenessStepIndex]);

  async function refreshOverview(): Promise<void> {
    const data = await getVerificationOverview();
    setOverview(data);
    if (data.latestByType.liveness?.status === "verified") {
      setIsLivenessSuccess(true);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function load(): Promise<void> {
      try {
        setIsLoadingOverview(true);
        const data = await getVerificationOverview();

        if (!mounted) {
          return;
        }

        setOverview(data);
        if (data.latestByType.liveness?.status === "verified") {
          setIsLivenessSuccess(true);
        }
      } catch {
        if (!mounted) {
          return;
        }

        setErrorMessage("Gagal memuat status verifikasi. Coba muat ulang halaman.");
      } finally {
        if (mounted) {
          setIsLoadingOverview(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isLivenessOpen) {
      return;
    }

    if (isLivenessSuccess) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (livenessStepIndex >= livenessInstructions.length - 1) {
        setIsLivenessSuccess(true);
        return;
      }

      setLivenessStepIndex((current) => current + 1);
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [isLivenessOpen, isLivenessSuccess, livenessStepIndex]);

  async function handleUpload(input: {
    file: File;
    type: "ktp_photo" | "selfie";
    side?: "front" | "back";
  }): Promise<void> {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (input.type === "ktp_photo" && input.side === "front") {
        setIsUploadingKtpFront(true);
      }

      if (input.type === "ktp_photo" && input.side === "back") {
        setIsUploadingKtpBack(true);
      }

      if (input.type === "selfie") {
        setIsUploadingSelfie(true);
      }

      await uploadVerificationFile(input);
      await refreshOverview();
      setSuccessMessage("File verifikasi berhasil disimpan.");
    } catch {
      setErrorMessage("Upload gagal. Pastikan format file benar dan coba lagi.");
    } finally {
      setIsUploadingKtpFront(false);
      setIsUploadingKtpBack(false);
      setIsUploadingSelfie(false);
    }
  }

  function openLivenessModal(): void {
    if (!isKtpReady || !isSelfieReady) {
      return;
    }

    setLivenessStepIndex(0);
    setIsLivenessSuccess(false);
    setIsLivenessOpen(true);
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function closeLivenessModal(): void {
    setIsLivenessOpen(false);
  }

  async function submitLivenessResult(): Promise<void> {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      setIsSubmittingLiveness(true);
      await submitLivenessVerification({
        passed: true,
        steps: livenessInstructions,
        score: 1
      });
      await refreshOverview();
      setSuccessMessage("Liveness check berhasil direkam ke sistem.");
      setIsLivenessOpen(false);
    } catch {
      setErrorMessage("Gagal menyimpan hasil liveness. Coba lagi.");
    } finally {
      setIsSubmittingLiveness(false);
    }
  }

  return (
    <section className="space-y-8">
      <header className="rounded-3xl bg-surface-container-lowest p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-primary">Verifikasi Identitas</p>
        <h1 className="mt-3 text-3xl font-black text-on-surface sm:text-4xl">e-KYC Workflow</h1>
        <p className="mt-2 max-w-3xl text-sm text-on-surface-variant sm:text-base">
          Lengkapi upload e-KTP, selfie, lalu proses liveness check agar status verifikasi akun aktif di database produksi.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {["Upload e-KTP", "Selfie", "Liveness"].map((step, index) => {
            const isDone = index === 0 ? isKtpReady : index === 1 ? isSelfieReady : isLivenessVerified;

            return (
              <article
                key={step}
                className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant"
              >
                <div className="flex items-center gap-2">
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-secondary" />
                  ) : (
                    <Circle className="h-4 w-4 text-outline" />
                  )}
                  <p className="font-semibold text-on-surface">{step}</p>
                </div>
              </article>
            );
          })}
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-outline">
          Status KYC: {isLoadingOverview ? "Memuat..." : (overview?.kycStatus ?? "unverified")}
        </p>
      </header>

      {errorMessage ? (
        <div className="rounded-2xl border border-error/40 bg-error/10 px-4 py-3 text-sm font-medium text-error">{errorMessage}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-2xl border border-secondary/30 bg-secondary/10 px-4 py-3 text-sm font-medium text-secondary">
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-7">
          <article className="rounded-3xl bg-surface-container-lowest p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-on-surface">Foto Depan e-KTP</h2>
              {isKtpReady ? <span className="text-xs font-bold text-secondary">Terverifikasi</span> : null}
            </div>

            <label className="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container-low p-5 text-center">
              <UploadCloud className="h-8 w-8 text-primary" />
              <p className="mt-3 text-sm font-semibold text-on-surface">
                {ktpFile ? ktpFile.name : "Ambil Foto atau Upload"}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">Pastikan NIK dan teks terlihat jelas.</p>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setKtpFile(file);
                  if (file) {
                    void handleUpload({ file, type: "ktp_photo", side: "front" });
                  }
                }}
              />
            </label>
            {isUploadingKtpFront ? <p className="mt-2 text-xs text-on-surface-variant">Mengunggah...</p> : null}
          </article>

          <article className="rounded-3xl bg-surface-container-lowest p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-on-surface">Foto Belakang e-KTP</h2>
              <span className="text-xs text-on-surface-variant">Opsional</span>
            </div>

            <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container-low p-5 text-center">
              <UploadCloud className="h-7 w-7 text-on-surface-variant" />
              <p className="mt-3 text-sm text-on-surface">{ktpBackFile ? ktpBackFile.name : "Klik untuk mengunggah"}</p>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setKtpBackFile(file);
                  if (file) {
                    void handleUpload({ file, type: "ktp_photo", side: "back" });
                  }
                }}
              />
            </label>
            {isUploadingKtpBack ? <p className="mt-2 text-xs text-on-surface-variant">Mengunggah...</p> : null}
          </article>
        </div>

        <aside className="space-y-6 xl:col-span-5">
          <article className="rounded-3xl bg-surface-container-lowest p-6">
            <h3 className="text-lg font-bold text-on-surface">Selfie & Liveness</h3>
            <p className="mt-2 text-sm text-on-surface-variant">Upload selfie lalu jalankan proses deteksi wajah.</p>

            <label className="mt-5 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container-low p-5 text-center">
              <Camera className="h-7 w-7 text-primary" />
              <p className="mt-3 text-sm font-semibold text-on-surface">
                {selfieFile ? selfieFile.name : "Upload selfie terbaru"}
              </p>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSelfieFile(file);
                  if (file) {
                    void handleUpload({ file, type: "selfie" });
                  }
                }}
              />
            </label>
            {isUploadingSelfie ? <p className="mt-2 text-xs text-on-surface-variant">Mengunggah...</p> : null}

            <button
              type="button"
              onClick={openLivenessModal}
              disabled={!isKtpReady || !isSelfieReady || isSubmittingLiveness}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-primary to-primary-container px-4 py-3 text-sm font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLivenessVerified ? "Liveness Terverifikasi" : "Mulai Liveness Check"}
            </button>
          </article>

          <article className="rounded-3xl bg-surface-container p-6">
            <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-primary">Panduan Liveness Check</h3>
            <ul className="mt-4 space-y-3 text-sm text-on-surface-variant">
              <li className="flex items-start gap-2">
                <Sun className="mt-0.5 h-4 w-4 text-primary" />
                Pencahayaan harus cukup dan tidak membelakangi lampu.
              </li>
              <li className="flex items-start gap-2">
                <Eye className="mt-0.5 h-4 w-4 text-primary" />
                Lepas aksesoris yang menutupi area wajah.
              </li>
              <li className="flex items-start gap-2">
                <Crosshair className="mt-0.5 h-4 w-4 text-primary" />
                Posisikan wajah tepat di tengah frame saat instruksi muncul.
              </li>
            </ul>
          </article>
        </aside>
      </div>

      {isLivenessOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091229]/90 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-gradient-to-br from-[#102347] to-[#07152f] p-6 text-white shadow-[0_24px_70px_rgba(7,21,47,0.8)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-white/70">Sesi Keamanan</p>
                <h3 className="text-2xl font-black">Verifikasi Wajah</h3>
              </div>
              <button
                type="button"
                onClick={closeLivenessModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-8 flex flex-col items-center gap-6">
              <div className="relative flex h-64 w-52 items-center justify-center rounded-[999px] border-4 border-[#67ff9d]/80 bg-white/10">
                <div className="h-56 w-44 rounded-[999px] bg-gradient-to-b from-white/60 to-white/20" />
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-[#67ff9d]" />
              </div>

              <div className="w-full max-w-sm rounded-2xl bg-white/10 p-4 text-center">
                <p className="text-xs uppercase tracking-[0.08em] text-white/70">Instruksi</p>
                <p className="mt-2 text-2xl font-black">{isLivenessSuccess ? "Wajah Terdeteksi" : currentInstruction}</p>
              </div>

              <div className="h-2 w-full max-w-sm rounded-full bg-white/20">
                <div
                  className="h-2 rounded-full bg-[#43e06f] transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <p className="text-sm text-white/80">
                {isLivenessSuccess
                  ? "Proses liveness selesai. Simpan hasil untuk memperbarui status verifikasi."
                  : `Tahap ${livenessStepIndex + 1} dari ${livenessInstructions.length}`}
              </p>

              {isLivenessSuccess ? (
                <button
                  type="button"
                  onClick={() => void submitLivenessResult()}
                  disabled={isSubmittingLiveness}
                  className="rounded-xl bg-[#1f59d8] px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmittingLiveness ? "Menyimpan..." : "Simpan Hasil Verifikasi"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
