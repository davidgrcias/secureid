import nodemailer from "nodemailer";
import { env } from "../config/env";

type MailInput = {
  to: string;
  subject: string;
  html: string;
};

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
  await sendMail({
    to: input.to,
    subject: `Permintaan tanda tangan: ${input.envelopeTitle}`,
    html: `
      <p>Halo ${input.recipientName},</p>
      <p>Anda menerima permintaan tanda tangan untuk dokumen <strong>${input.envelopeTitle}</strong>.</p>
      <p><a href="${input.signUrl}">Klik di sini untuk menandatangani dokumen</a>.</p>
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
  await sendMail({
    to: input.to,
    subject: `Pengingat tanda tangan: ${input.envelopeTitle}`,
    html: `
      <p>Halo ${input.recipientName},</p>
      <p>Ini adalah pengingat untuk dokumen <strong>${input.envelopeTitle}</strong> yang belum ditandatangani.</p>
      <p><a href="${input.signUrl}">Lanjutkan proses tanda tangan</a>.</p>
      <p>SecureID</p>
    `
  });
}

export async function sendEnvelopeCompletedEmail(input: {
  to: string;
  senderName: string;
  envelopeTitle: string;
}): Promise<void> {
  await sendMail({
    to: input.to,
    subject: `Dokumen selesai ditandatangani: ${input.envelopeTitle}`,
    html: `
      <p>Halo ${input.senderName},</p>
      <p>Seluruh penandatangan telah menyelesaikan dokumen <strong>${input.envelopeTitle}</strong>.</p>
      <p>Anda dapat membuka dashboard SecureID untuk melihat audit trail lengkap.</p>
      <p>SecureID</p>
    `
  });
}
