"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getDashboardSummary, type DashboardSummary } from "@/lib/dashboard";
import { useAuthStore } from "@/stores/authStore";

function formatWeeklyChange(value: number): string {
  if (value > 0) {
    return `+${value}% minggu ini`;
  }

  if (value < 0) {
    return `${value}% minggu ini`;
  }

  return "Stabil minggu ini";
}

function mapEnvelopeStatus(status: string): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "sent":
      return "Terkirim";
    case "in_progress":
      return "Diproses";
    case "completed":
      return "Selesai";
    case "expired":
      return "Kedaluwarsa";
    case "cancelled":
      return "Dibatalkan";
    default:
      return status;
  }
}

export default function DashboardPage() {
  const currentUser = useAuthStore((state) => state.user);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard(): Promise<void> {
      try {
        setIsLoading(true);
        const data = await getDashboardSummary();
        if (!mounted) {
          return;
        }

        setSummary(data);
        setError(null);
      } catch {
        if (!mounted) {
          return;
        }

        setError("Gagal memuat dashboard. Coba muat ulang.");
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  const displayName = summary?.user.fullName ?? currentUser?.fullName ?? "Pengguna";
  const roleName = summary?.user.role ?? currentUser?.role ?? "member";

  const stats = useMemo(
    () =>
      summary?.stats ?? {
        totalDocuments: 0,
        totalEnvelopes: 0,
        pendingSignatureRequests: 0,
        myPendingActions: 0,
        weeklyDocumentChangePercent: 0
      },
    [summary]
  );

  return (
    <section className="space-y-8">
      <header className="rounded-3xl bg-surface-container-lowest p-6 shadow-[0_16px_40px_rgba(17,28,42,0.08)] sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-primary">Dashboard SecureID</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-on-surface sm:text-4xl">Halo, {displayName}</h1>
        <p className="mt-2 max-w-3xl text-sm text-on-surface-variant sm:text-base">
          Pantau status dokumen, progres penandatanganan, dan antrean aksi langsung dari data produksi terbaru.
        </p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.06em] text-outline">Peran: {roleName}</p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-error/40 bg-error/10 px-4 py-3 text-sm font-medium text-error">{error}</div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-3">
        <article className="rounded-2xl bg-surface-container-lowest p-6">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-outline">Total Dokumen</p>
          <p className="mt-3 text-4xl font-black text-on-surface">{isLoading ? "..." : stats.totalDocuments}</p>
          <p className="mt-2 text-sm text-secondary">{isLoading ? "Memuat..." : formatWeeklyChange(stats.weeklyDocumentChangePercent)}</p>
        </article>
        <article className="rounded-2xl bg-surface-container-lowest p-6">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-outline">Permintaan Tanda Tangan</p>
          <p className="mt-3 text-4xl font-black text-on-surface">{isLoading ? "..." : stats.pendingSignatureRequests}</p>
          <p className="mt-2 text-sm text-primary">{isLoading ? "Memuat..." : `${stats.myPendingActions} menunggu aksi Anda`}</p>
        </article>
        <article className="rounded-2xl bg-gradient-to-br from-primary to-primary-container p-6 text-on-primary shadow-[0_12px_30px_rgba(0,61,155,0.35)]">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-on-primary-container">Paket Organisasi</p>
          <p className="mt-3 text-4xl font-black">{(summary?.user.plan ?? "free").toUpperCase()}</p>
          <p className="mt-2 text-sm text-on-primary-container">Total envelope dibuat: {isLoading ? "..." : stats.totalEnvelopes}</p>
        </article>
      </div>

      <section className="rounded-3xl bg-surface-container-lowest p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-on-surface">Aktivitas Dokumen Terbaru</h2>
          <Link
            href="/dashboard/documents"
            className="rounded-xl bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container-high"
          >
            Lihat Semua
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20 text-xs uppercase tracking-[0.08em] text-outline">
                <th className="px-3 py-3">Envelope</th>
                <th className="px-3 py-3">Dokumen</th>
                <th className="px-3 py-3">Penanda Tangan</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {!isLoading && summary && summary.recentActivities.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-5 text-center text-on-surface-variant">
                    Belum ada aktivitas dokumen.
                  </td>
                </tr>
              ) : null}

              {summary?.recentActivities.map((activity) => (
                <tr key={`${activity.envelopeId}-${activity.createdAt}`} className="border-b border-outline-variant/10">
                  <td className="px-3 py-4 font-semibold text-primary">{activity.envelopeId.slice(0, 8).toUpperCase()}</td>
                  <td className="px-3 py-4 text-on-surface">{activity.documentTitle}</td>
                  <td className="px-3 py-4 text-on-surface-variant">{activity.signerName ?? "-"}</td>
                  <td className="px-3 py-4">
                    <span className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-bold text-on-surface">
                      {mapEnvelopeStatus(activity.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
