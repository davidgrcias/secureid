import nodemailer from "nodemailer";
import { env } from "../config/env";

type MailInput = {
  to: string;
  subject: string;
  html: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
    })
  : nodemailer.createTransport({
      streamTransport: true,
      newline: "unix",
      buffer: true
    });

async function sendMail(input: MailInput): Promise<void> {
  const fromAddress = env.SMTP_FROM || "SecureID <no-reply@secureid.local>";

  await transporter.sendMail({
    from: fromAddress,
    to: input.to,
    subject: input.subject,
    html: input.html
  });
}

export async function sendSigningRequestEmail(input: {
  to: string;
  recipientName: string;
  envelopeTitle: string;
  signUrl: string;
}): Promise<void> {
  const recipientName = escapeHtml(input.recipientName);
  const envelopeTitle = escapeHtml(input.envelopeTitle);
  const signUrl = escapeHtml(input.signUrl);

  await sendMail({
    to: input.to,
    subject: `Permintaan tanda tangan: ${input.envelopeTitle}`,
    html: `
      <p>Halo ${recipientName},</p>
      <p>Anda menerima permintaan tanda tangan untuk dokumen <strong>${envelopeTitle}</strong>.</p>
      <p><a href="${signUrl}">Klik di sini untuk menandatangani dokumen</a>.</p>
      <p>Terima kasih,<br/>SecureID</p>
    `
  });
}

export async function sendSigningReminderEmail(input: {
  to: string;
  recipientName: string;
  envelopeTitle: string;
  signUrl: string;
}): Promise<void> {
  const recipientName = escapeHtml(input.recipientName);
  const envelopeTitle = escapeHtml(input.envelopeTitle);
  const signUrl = escapeHtml(input.signUrl);

  await sendMail({
    to: input.to,
    subject: `Pengingat tanda tangan: ${input.envelopeTitle}`,
    html: `
      <p>Halo ${recipientName},</p>
      <p>Ini adalah pengingat untuk dokumen <strong>${envelopeTitle}</strong> yang belum ditandatangani.</p>
      <p><a href="${signUrl}">Lanjutkan proses tanda tangan</a>.</p>
      <p>SecureID</p>
    `
  });
}

export async function sendEnvelopeCompletedEmail(input: {
  to: string;
  senderName: string;
  envelopeTitle: string;
}): Promise<void> {
  const senderName = escapeHtml(input.senderName);
  const envelopeTitle = escapeHtml(input.envelopeTitle);

  await sendMail({
    to: input.to,
    subject: `Dokumen selesai ditandatangani: ${input.envelopeTitle}`,
    html: `
      <p>Halo ${senderName},</p>
      <p>Seluruh penandatangan telah menyelesaikan dokumen <strong>${envelopeTitle}</strong>.</p>
      <p>Anda dapat membuka dashboard SecureID untuk melihat audit trail lengkap.</p>
      <p>SecureID</p>
    `
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  resetUrl: string;
}): Promise<void> {
  const resetUrl = escapeHtml(input.resetUrl);

  await sendMail({
    to: input.to,
    subject: "Reset kata sandi SecureID",
    html: `
      <p>Kami menerima permintaan reset kata sandi untuk akun Anda.</p>
      <p><a href="${resetUrl}">Klik di sini untuk membuat kata sandi baru</a>.</p>
      <p>Jika Anda tidak melakukan permintaan ini, abaikan email ini.</p>
      <p>SecureID</p>
    `
  });
}
