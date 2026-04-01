"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, FilePlus2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { listDocuments, type WorkflowDocument } from "@/lib/workflow";

function statusBadgeClass(status: string): string {
  if (status === "archived") {
    return "bg-surface-container text-on-surface-variant";
  }

  if (status === "ready") {
    return "bg-secondary/10 text-secondary";
  }

  return "bg-primary/10 text-primary";
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<WorkflowDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    listDocuments()
      .then((items) => {
        if (!isMounted) {
          return;
        }

        setDocuments(items);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setErrorMessage("Gagal memuat daftar dokumen. Coba refresh halaman.");
      })
      .finally(() => {
        if (!isMounted) {
          return;
        }

        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="space-y-6 rounded-3xl bg-surface-container-lowest p-6 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-primary">Dokumen Saya</p>
          <h1 className="mt-3 text-3xl font-black text-on-surface">Kelola Dokumen</h1>
          <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
            Pantau status dokumen, arsip, dan progress tanda tangan dalam satu tabel operasional.
          </p>
        </div>

        <Link
          href="/dashboard/send"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-container px-4 py-3 text-sm font-bold text-on-primary"
        >
          <FilePlus2 className="h-4 w-4" />
          Kirim Dokumen Baru
        </Link>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-3 rounded-2xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Memuat daftar dokumen...
        </div>
      ) : null}

      {errorMessage ? (
        <div className="flex items-start gap-3 rounded-2xl bg-error-container px-4 py-3 text-sm text-error">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {!isLoading && !errorMessage && documents.length === 0 ? (
        <article className="rounded-2xl border border-dashed border-outline-variant/30 bg-surface-container-low p-8 text-center">
          <p className="text-xl font-bold text-on-surface">Belum ada dokumen</p>
          <p className="mt-2 text-sm text-on-surface-variant">
            Mulai dengan upload dokumen pertama Anda untuk proses tanda tangan digital.
          </p>
          <Link
            href="/dashboard/send"
            className="mt-4 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary"
          >
            Upload Sekarang
          </Link>
        </article>
      ) : null}

      {!isLoading && !errorMessage && documents.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-outline-variant/20">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="bg-surface-container-low text-xs uppercase tracking-[0.08em] text-outline">
                <th className="px-4 py-3">Judul</th>
                <th className="px-4 py-3">Nama File</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Dibuat</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id} className="border-t border-outline-variant/10">
                  <td className="px-4 py-4 font-semibold text-on-surface">{document.title}</td>
                  <td className="px-4 py-4 text-on-surface-variant">{document.originalFilename}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusBadgeClass(document.status)}`}>
                      {document.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-on-surface-variant">
                    {new Date(document.createdAt).toLocaleDateString("id-ID")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
