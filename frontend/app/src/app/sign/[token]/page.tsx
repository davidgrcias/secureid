"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, LoaderCircle, PenTool } from "lucide-react";
import { useParams } from "next/navigation";
import SignatureModal from "@/components/signature/SignatureModal";
import {
  completeSigning,
  getSigningDocumentBlob,
  getSigningSession,
  type SigningSession
} from "@/lib/signing";

type SignaturePayload = {
  type: "draw" | "type" | "upload";
  value: string;
  fontFamily?: string;
};

export default function PublicSigningPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [session, setSession] = useState<SigningSession | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [signaturePayload, setSignaturePayload] = useState<SignaturePayload | undefined>(undefined);
  const [targetSignatureFieldId, setTargetSignatureFieldId] = useState<string | null>(null);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    getSigningSession(token)
      .then((payload) => {
        setSession(payload);

        const initialValues: Record<string, string> = {};
        payload.fields.forEach((field) => {
          initialValues[field.id] = field.value ?? "";
        });

        setFieldValues(initialValues);
      })
      .catch((error: unknown) => {
        if (typeof error === "object" && error && "response" in error) {
          const maybeResponse = error as { response?: { data?: { message?: string } } };
          setErrorMessage(maybeResponse.response?.data?.message ?? "Link signing tidak valid atau sudah kedaluwarsa.");
        } else {
          setErrorMessage("Gagal memuat sesi signing.");
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [token]);

  useEffect(() => {
    if (!token || !session) {
      return;
    }

    let mounted = true;
    let objectUrl: string | null = null;

    setIsLoadingPreview(true);

    getSigningDocumentBlob(token)
      .then((blob) => {
        if (!mounted) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setDocumentPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (!mounted) {
          return;
        }

        setDocumentPreviewUrl(null);
      })
      .finally(() => {
        if (mounted) {
          setIsLoadingPreview(false);
        }
      });

    return () => {
      mounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [session, token]);

  const requiredFieldIds = useMemo(() => {
    if (!session) {
      return [];
    }

    return session.fields.filter((field) => field.required).map((field) => field.id);
  }, [session]);

  function updateFieldValue(fieldId: string, value: string): void {
    setFieldValues((current) => ({
      ...current,
      [fieldId]: value
    }));
  }

  async function handleSubmit(): Promise<void> {
    if (!session) {
      return;
    }

    const hasMissingRequiredField = requiredFieldIds.some((fieldId) => !fieldValues[fieldId]?.trim());
    if (hasMissingRequiredField) {
      setErrorMessage("Masih ada field wajib yang belum diisi.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      await completeSigning(token, {
        fields: session.fields.map((field) => ({
          fieldId: field.id,
          value: fieldValues[field.id]
        })),
        signature: signaturePayload
      });

      setSuccessMessage("Dokumen berhasil ditandatangani. Anda dapat menutup halaman ini.");
    } catch (error: unknown) {
      if (typeof error === "object" && error && "response" in error) {
        const maybeResponse = error as { response?: { data?: { message?: string } } };
        setErrorMessage(maybeResponse.response?.data?.message ?? "Gagal menyelesaikan proses signing.");
      } else {
        setErrorMessage("Gagal menyelesaikan proses signing.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-dvh bg-background px-4 py-8 sm:px-6">
      <section className="mx-auto w-full max-w-4xl space-y-5 rounded-3xl bg-surface-container-lowest p-6 shadow-[0_20px_50px_rgba(17,28,42,0.12)] sm:p-8">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-primary">Public Signing Link</p>
          <h1 className="mt-3 text-3xl font-black text-on-surface">Tanda Tangan Dokumen</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Verifikasi data Anda, isi field yang diminta, lalu selesaikan proses tanda tangan digital.
          </p>
        </header>

        {isLoading ? (
          <div className="flex items-center gap-3 rounded-2xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Memuat detail dokumen...
          </div>
        ) : null}

        {errorMessage ? (
          <div className="flex items-start gap-3 rounded-2xl bg-error-container px-4 py-3 text-sm text-error">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {successMessage ? (
          <div className="flex items-start gap-3 rounded-2xl bg-secondary/10 px-4 py-3 text-sm text-secondary">
            <CheckCircle2 className="mt-0.5 h-4 w-4" />
            <span>{successMessage}</span>
          </div>
        ) : null}

        {session ? (
          <>
            <article className="grid gap-4 rounded-2xl bg-surface-container-low p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Dokumen</p>
                <p className="mt-1 text-sm font-semibold text-on-surface">{session.document.title}</p>
                <p className="text-xs text-on-surface-variant">{session.document.originalFilename}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Penerima</p>
                <p className="mt-1 text-sm font-semibold text-on-surface">{session.recipient.name}</p>
                <p className="text-xs text-on-surface-variant">{session.recipient.email}</p>
              </div>
            </article>

            <article className="space-y-3 rounded-2xl bg-surface-container-low p-4">
              <h2 className="text-lg font-bold text-on-surface">Preview Dokumen</h2>
              {isLoadingPreview ? (
                <div className="flex items-center gap-2 rounded-xl bg-surface-container px-3 py-2 text-sm text-on-surface-variant">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Memuat preview dokumen...
                </div>
              ) : null}

              {documentPreviewUrl ? (
                <iframe
                  title="Preview dokumen signing"
                  src={documentPreviewUrl}
                  className="h-[520px] w-full rounded-xl border border-outline-variant/30 bg-white"
                />
              ) : (
                <p className="rounded-xl bg-surface-container px-3 py-3 text-sm text-on-surface-variant">
                  Preview tidak tersedia. Anda tetap dapat melanjutkan proses jika data sudah benar.
                </p>
              )}
            </article>

            <section className="space-y-4 rounded-2xl bg-surface-container-low p-4">
              <h2 className="text-lg font-bold text-on-surface">Field Penandatanganan</h2>

              {session.fields.map((field) => {
                const isSignatureField = field.fieldType === "signature" || field.fieldType === "initial";

                return (
                  <article key={field.id} className="rounded-xl bg-surface-container p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.08em] text-primary">
                      {field.fieldType} {field.required ? "(Wajib)" : "(Opsional)"}
                    </p>

                    {field.fieldType === "text" ? (
                      <input
                        value={fieldValues[field.id] ?? ""}
                        onChange={(event) => updateFieldValue(field.id, event.target.value)}
                        className="mt-2 w-full rounded-lg bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none"
                        placeholder="Isi nilai field"
                      />
                    ) : null}

                    {field.fieldType === "date" ? (
                      <input
                        type="date"
                        value={fieldValues[field.id] ?? ""}
                        onChange={(event) => updateFieldValue(field.id, event.target.value)}
                        className="mt-2 w-full rounded-lg bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none"
                      />
                    ) : null}

                    {field.fieldType === "checkbox" ? (
                      <label className="mt-2 flex items-center gap-2 text-sm text-on-surface">
                        <input
                          type="checkbox"
                          checked={fieldValues[field.id] === "true"}
                          onChange={(event) => updateFieldValue(field.id, event.target.checked ? "true" : "")}
                        />
                        Saya menyetujui isi dokumen
                      </label>
                    ) : null}

                    {isSignatureField ? (
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setTargetSignatureFieldId(field.id)}
                          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary"
                        >
                          <PenTool className="h-3.5 w-3.5" />
                          Buat Signature
                        </button>
                        <span className="text-xs text-on-surface-variant">
                          {fieldValues[field.id] ? "Signature tersimpan." : "Belum ada signature."}
                        </span>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </section>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || Boolean(successMessage)}
              className="w-full rounded-xl bg-gradient-to-r from-primary to-primary-container px-5 py-3 text-sm font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Memproses Tanda Tangan..." : "Selesaikan Tanda Tangan"}
            </button>
          </>
        ) : null}
      </section>

      <SignatureModal
        open={Boolean(targetSignatureFieldId)}
        onClose={() => setTargetSignatureFieldId(null)}
        onSubmit={(payload) => {
          if (!targetSignatureFieldId) {
            return;
          }

          setSignaturePayload(payload);
          updateFieldValue(targetSignatureFieldId, payload.value);
          setTargetSignatureFieldId(null);
        }}
      />
    </main>
  );
}
