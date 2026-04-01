"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  CheckSquare,
  FileSignature,
  SendHorizonal,
  Type,
  UploadCloud,
  X
} from "lucide-react";
import { createEnvelope, saveEnvelopeFields, sendEnvelope, uploadDocument } from "@/lib/workflow";

type RecipientRole = "signer" | "viewer" | "approver";
type FieldType = "signature" | "initial" | "date" | "text" | "checkbox";

type DraftRecipient = {
  id: string;
  name: string;
  email: string;
  role: RecipientRole;
};

type EnvelopeRecipient = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type DraftField = {
  id: string;
  fieldType: FieldType;
  recipientId: string | null;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
};

const fieldLibrary: Array<{ fieldType: FieldType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { fieldType: "signature", label: "Tanda Tangan", icon: FileSignature },
  { fieldType: "date", label: "Tanggal", icon: Calendar },
  { fieldType: "text", label: "Teks", icon: Type },
  { fieldType: "checkbox", label: "Centang", icon: CheckSquare }
];

const steps = ["Upload Dokumen", "Builder Field", "Review Sebelum Kirim"];

function createRecipient(): DraftRecipient {
  return {
    id: crypto.randomUUID(),
    name: "",
    email: "",
    role: "signer"
  };
}

export default function SendPage() {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [recipients, setRecipients] = useState<DraftRecipient[]>([createRecipient()]);
  const [envelopeRecipients, setEnvelopeRecipients] = useState<EnvelopeRecipient[]>([]);

  const [envelopeId, setEnvelopeId] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [fields, setFields] = useState<DraftField[]>([]);
  const [selectedFieldType, setSelectedFieldType] = useState<FieldType>("signature");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canProceedToBuilder = useMemo(() => {
    const hasSignerRecipient = recipients.some((recipient) => recipient.role === "signer");

    return Boolean(
      title.trim() &&
        file &&
        recipients.length > 0 &&
        hasSignerRecipient &&
        recipients.every((recipient) => recipient.name.trim() && recipient.email.trim())
    );
  }, [file, recipients, title]);

  function updateRecipient(recipientId: string, nextValue: Partial<DraftRecipient>): void {
    setRecipients((current) =>
      current.map((recipient) => (recipient.id === recipientId ? { ...recipient, ...nextValue } : recipient))
    );
  }

  function removeRecipient(recipientId: string): void {
    setRecipients((current) => (current.length > 1 ? current.filter((recipient) => recipient.id !== recipientId) : current));
  }

  function addField(fieldType: FieldType): void {
    setFields((current) => {
      const index = current.length;
      const defaultRecipient = envelopeRecipients.find((recipient) => recipient.role === "signer") ?? envelopeRecipients[0];

      return [
        ...current,
        {
          id: crypto.randomUUID(),
          fieldType,
          recipientId: defaultRecipient?.id ?? null,
          positionX: 10 + ((index * 11) % 70),
          positionY: 12 + ((index * 13) % 70),
          width: fieldType === "checkbox" ? 12 : 30,
          height: fieldType === "checkbox" ? 8 : 12
        }
      ];
    });
  }

  async function handleProceedToBuilder(): Promise<void> {
    if (!file || !canProceedToBuilder) {
      setErrorMessage("Lengkapi judul, file, dan data penerima, serta pastikan ada minimal satu signer.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const uploadedDocument = await uploadDocument({
        file,
        title,
        description
      });

      const createdEnvelope = await createEnvelope({
        documentId: uploadedDocument.id,
        title,
        message: description,
        recipients: recipients.map((recipient, index) => ({
          email: recipient.email,
          name: recipient.name,
          role: recipient.role,
          signingOrder: index + 1
        }))
      });

      setDocumentId(uploadedDocument.id);
      setEnvelopeId(createdEnvelope.envelope.id);
      setEnvelopeRecipients(createdEnvelope.recipients);
      setStep(1);
    } catch {
      setErrorMessage("Gagal membuat draft pengiriman dokumen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendDocument(): Promise<void> {
    if (!envelopeId || !documentId) {
      setErrorMessage("Draft envelope belum terbentuk.");
      return;
    }

    if (fields.length === 0) {
      setErrorMessage("Tambahkan minimal satu field sebelum mengirim.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      await saveEnvelopeFields(
        envelopeId,
        fields.map((field) => ({
          recipientId: field.recipientId ?? undefined,
          fieldType: field.fieldType,
          pageNumber: 1,
          positionX: field.positionX,
          positionY: field.positionY,
          width: field.width,
          height: field.height,
          required: true
        }))
      );

      await sendEnvelope(envelopeId);

      setSuccessMessage("Dokumen berhasil dikirim ke seluruh penerima.");
      setStep(2);
    } catch {
      setErrorMessage("Gagal mengirim dokumen. Coba ulangi beberapa saat lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="rounded-3xl bg-surface-container-lowest p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-primary">Dokumen / Kirim Baru</p>
        <h1 className="mt-3 text-3xl font-black text-on-surface sm:text-4xl">Kirim Dokumen</h1>
        <p className="mt-2 max-w-3xl text-sm text-on-surface-variant sm:text-base">
          Jalankan alur lengkap upload, builder field, review, lalu kirim ke penandatangan secara berurutan.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {steps.map((label, index) => {
            const isCurrent = index === step;
            const isDone = index < step;

            return (
              <article
                key={label}
                className={`rounded-2xl px-4 py-3 text-sm ${
                  isCurrent
                    ? "bg-primary text-on-primary"
                    : isDone
                      ? "bg-secondary/10 text-secondary"
                      : "bg-surface-container-low text-on-surface-variant"
                }`}
              >
                <p className="font-semibold">{label}</p>
              </article>
            );
          })}
        </div>
      </header>

      {errorMessage ? <p className="rounded-2xl bg-error-container px-4 py-3 text-sm text-error">{errorMessage}</p> : null}
      {successMessage ? (
        <p className="rounded-2xl bg-secondary/10 px-4 py-3 text-sm text-secondary">{successMessage}</p>
      ) : null}

      {step === 0 ? (
        <div className="grid gap-6 xl:grid-cols-12">
          <article className="space-y-4 rounded-3xl bg-surface-container-lowest p-6 xl:col-span-8">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Judul Dokumen</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none ring-2 ring-transparent focus:ring-primary/40"
                placeholder="Perjanjian Kerjasama Vendor Q4"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Deskripsi (Opsional)</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                className="w-full rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none ring-2 ring-transparent focus:ring-primary/40"
                placeholder="Tambahkan catatan singkat untuk para penandatangan."
              />
            </div>

            <label className="flex min-h-60 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container-low p-6 text-center">
              <UploadCloud className="h-9 w-9 text-primary" />
              <p className="mt-4 text-base font-semibold text-on-surface">
                {file ? file.name : "Tarik atau pilih file PDF/DOC"}
              </p>
              <p className="mt-2 text-sm text-on-surface-variant">Mendukung .pdf, .doc, .docx, .jpg, .png (maks 25MB)</p>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </article>

          <aside className="rounded-3xl bg-surface-container-lowest p-6 xl:col-span-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-on-surface">Penerima</h2>
              <button
                type="button"
                onClick={() => setRecipients((current) => [...current, createRecipient()])}
                className="rounded-lg bg-surface-container px-3 py-1 text-xs font-semibold text-primary"
              >
                + Tambah
              </button>
            </div>

            <div className="space-y-3">
              {recipients.map((recipient, index) => (
                <article key={recipient.id} className="rounded-2xl bg-surface-container-low p-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-on-surface-variant">
                    <span>Penerima {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeRecipient(recipient.id)}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface-container text-on-surface-variant"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <input
                    value={recipient.name}
                    onChange={(event) => updateRecipient(recipient.id, { name: event.target.value })}
                    placeholder="Nama lengkap"
                    className="mb-2 w-full rounded-lg bg-surface-container px-3 py-2 text-sm text-on-surface outline-none"
                  />
                  <input
                    value={recipient.email}
                    onChange={(event) => updateRecipient(recipient.id, { email: event.target.value })}
                    placeholder="Email"
                    className="mb-2 w-full rounded-lg bg-surface-container px-3 py-2 text-sm text-on-surface outline-none"
                  />
                  <select
                    value={recipient.role}
                    onChange={(event) => updateRecipient(recipient.id, { role: event.target.value as RecipientRole })}
                    className="w-full rounded-lg bg-surface-container px-3 py-2 text-sm text-on-surface outline-none"
                  >
                    <option value="signer">Signer</option>
                    <option value="viewer">Viewer</option>
                    <option value="approver">Approver</option>
                  </select>
                </article>
              ))}
            </div>

            <button
              type="button"
              onClick={handleProceedToBuilder}
              disabled={!canProceedToBuilder || isSubmitting}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-primary to-primary-container px-4 py-3 text-sm font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Menyiapkan Builder..." : "Lanjut ke Builder Field"}
            </button>
          </aside>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-6 xl:grid-cols-12">
          <aside className="space-y-3 rounded-3xl bg-surface-container-lowest p-5 xl:col-span-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-primary">Field Elements</h2>
            {fieldLibrary.map((item) => {
              const Icon = item.icon;
              const active = selectedFieldType === item.fieldType;

              return (
                <button
                  key={item.fieldType}
                  type="button"
                  onClick={() => {
                    setSelectedFieldType(item.fieldType);
                    addField(item.fieldType);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${
                    active ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </aside>

          <article className="rounded-3xl bg-surface-container-lowest p-5 xl:col-span-6">
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-on-surface-variant">Annotation Studio</h3>
            <div className="mt-4 min-h-[560px] rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container-low p-6">
              <div className="relative mx-auto h-[500px] max-w-xl rounded-xl bg-white shadow-[0_16px_40px_rgba(17,28,42,0.08)]">
                {fields.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-on-surface-variant">
                    <p className="text-lg font-bold text-on-surface">Belum ada field ditempatkan</p>
                    <p className="mt-2 text-sm">Klik tombol field di panel kiri untuk menambahkan area tanda tangan.</p>
                  </div>
                ) : (
                  fields.map((field) => (
                    <div
                      key={field.id}
                      className="absolute rounded-lg border-2 border-dashed border-primary bg-primary/5 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-primary"
                      style={{
                        left: `${field.positionX}%`,
                        top: `${field.positionY}%`,
                        width: `${field.width}%`,
                        height: `${field.height}%`
                      }}
                    >
                      {field.fieldType}
                    </div>
                  ))
                )}
              </div>
            </div>
          </article>

          <aside className="rounded-3xl bg-surface-container-lowest p-5 xl:col-span-3">
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-primary">Daftar Field</h3>
            <div className="mt-4 space-y-2">
              {fields.map((field, index) => (
                <div key={field.id} className="space-y-2 rounded-xl bg-surface-container-low px-3 py-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-on-surface">
                      {index + 1}. {field.fieldType}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFields((current) => current.filter((item) => item.id !== field.id))}
                      className="text-on-surface-variant hover:text-error"
                    >
                      Hapus
                    </button>
                  </div>

                  <select
                    value={field.recipientId ?? ""}
                    onChange={(event) =>
                      setFields((current) =>
                        current.map((item) =>
                          item.id === field.id
                            ? {
                                ...item,
                                recipientId: event.target.value || null
                              }
                            : item
                        )
                      )
                    }
                    className="w-full rounded-lg bg-surface-container px-2 py-2 text-xs text-on-surface outline-none"
                  >
                    <option value="">Semua penerima</option>
                    {envelopeRecipients.map((recipient) => (
                      <option key={recipient.id} value={recipient.id}>
                        {recipient.name} ({recipient.role})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={fields.length === 0}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-primary to-primary-container px-4 py-3 text-sm font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Review Sebelum Kirim
            </button>
          </aside>
        </div>
      ) : null}

      {step === 2 ? (
        <article className="rounded-3xl bg-surface-container-lowest p-6 sm:p-8">
          <h2 className="text-2xl font-black text-on-surface">Review Sebelum Kirim</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Pastikan dokumen, penerima, dan field penandatanganan sudah sesuai sebelum dikirim.
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl bg-surface-container-low p-4">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Informasi Dokumen</p>
              <p className="mt-3 text-sm font-semibold text-on-surface">{title}</p>
              <p className="mt-1 text-xs text-on-surface-variant">{file?.name}</p>
            </div>

            <div className="rounded-2xl bg-surface-container-low p-4">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Penerima</p>
              <ul className="mt-3 space-y-2 text-sm text-on-surface">
                {recipients.map((recipient) => (
                  <li key={recipient.id}>
                    {recipient.name} - {recipient.email}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-surface-container-low p-4">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant">Field</p>
              <p className="mt-3 text-sm text-on-surface">Total {fields.length} field ditempatkan.</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-xl bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface"
            >
              Kembali ke Builder
            </button>
            <button
              type="button"
              onClick={handleSendDocument}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-container px-5 py-3 text-sm font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SendHorizonal className="h-4 w-4" />
              {isSubmitting ? "Mengirim..." : "Kirim untuk Ditandatangani"}
            </button>
          </div>
        </article>
      ) : null}
    </section>
  );
}
