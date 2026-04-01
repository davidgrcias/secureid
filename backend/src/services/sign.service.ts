import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pool, query } from "../config/database";
import { env } from "../config/env";
import { ApiError } from "../middleware/error.middleware";
import { syncDocumentWorkflowStatus } from "./documentWorkflow.service";
import { applySignatureFieldsToPdf } from "../utils/pdf";
import { sendEnvelopeCompletedEmail, sendSigningRequestEmail } from "./email.service";
import { createNotification } from "./notification.service";

type DbSigningSessionRow = {
  recipient_id: string;
  recipient_user_id: string | null;
  recipient_email: string;
  recipient_name: string;
  recipient_role: string;
  recipient_status: string;
  recipient_signing_order: number;
  access_token: string;
  envelope_id: string;
  envelope_title: string;
  envelope_message: string | null;
  envelope_status: string;
  sequential_signing: boolean;
  expires_at: Date | string | null;
  sender_id: string;
  sender_name: string;
  sender_email: string;
  document_id: string;
  document_title: string;
  document_file_path: string;
  document_original_filename: string;
  document_hash_sha256: string;
};

type DbRecipientProgressRow = {
  id: string;
  user_id: string | null;
  email: string;
  name: string;
  role: string;
  status: string;
  signing_order: number;
  access_token: string;
};

type DbFieldRow = {
  id: string;
  envelope_id: string;
  recipient_id: string | null;
  field_type: string;
  page_number: number;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  required: boolean;
  value: string | null;
  filled_at: Date | string | null;
};

export type PublicSigningField = {
  id: string;
  recipientId: string | null;
  fieldType: string;
  pageNumber: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  required: boolean;
  value: string | null;
};

export type PublicSigningSession = {
  envelope: {
    id: string;
    title: string;
    message: string | null;
    status: string;
    sequentialSigning: boolean;
    expiresAt: string | null;
  };
  document: {
    id: string;
    title: string;
    originalFilename: string;
  };
  recipient: {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    signingOrder: number;
  };
  fields: PublicSigningField[];
};

export type SigningPayloadField = {
  fieldId: string;
  value?: string;
};

export type SigningPayload = {
  token: string;
  fields: SigningPayloadField[];
  signature?: {
    type: "draw" | "type" | "upload";
    value: string;
    fontFamily?: string;
  };
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type SigningResult = {
  envelopeId: string;
  envelopeStatus: string;
  completed: boolean;
};

function toIsoString(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapField(row: DbFieldRow): PublicSigningField {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    fieldType: row.field_type,
    pageNumber: row.page_number,
    positionX: row.position_x,
    positionY: row.position_y,
    width: row.width,
    height: row.height,
    required: row.required,
    value: row.value
  };
}

function buildSignUrl(token: string): string {
  return `${env.CORS_ORIGIN.replace(/\/$/, "")}/sign/${token}`;
}

function ensureEnvelopeIsSignable(row: DbSigningSessionRow): void {
  if (row.envelope_status === "voided" || row.envelope_status === "expired") {
    throw new ApiError(400, "Envelope sudah tidak aktif.");
  }

  if (row.envelope_status === "completed") {
    throw new ApiError(400, "Dokumen sudah selesai ditandatangani.");
  }
}

function ensureRecipientCanSign(row: DbSigningSessionRow): void {
  if (row.recipient_role !== "signer") {
    throw new ApiError(403, "Hanya recipient dengan role signer yang dapat menandatangani dokumen.");
  }
}

function enforceSequentialSigning(
  sequentialSigning: boolean,
  recipientId: string,
  recipients: DbRecipientProgressRow[]
): void {
  if (!sequentialSigning) {
    return;
  }

  const nextSigner = recipients.find(
    (recipient) => recipient.role === "signer" && recipient.status !== "signed" && recipient.status !== "declined"
  );

  if (nextSigner && nextSigner.id !== recipientId) {
    throw new ApiError(409, `Menunggu tanda tangan ${nextSigner.name} terlebih dahulu.`);
  }
}

async function getSessionByToken(token: string): Promise<DbSigningSessionRow> {
  const result = await query<DbSigningSessionRow>(
    `
      SELECT
        er.id AS recipient_id,
        er.user_id AS recipient_user_id,
        er.email AS recipient_email,
        er.name AS recipient_name,
        er.role AS recipient_role,
        er.status AS recipient_status,
        er.signing_order AS recipient_signing_order,
        er.access_token,
        e.id AS envelope_id,
        e.title AS envelope_title,
        e.message AS envelope_message,
        e.status AS envelope_status,
        e.sequential_signing,
        e.expires_at,
        e.sender_id,
        sender.full_name AS sender_name,
        sender.email AS sender_email,
        d.id AS document_id,
        d.title AS document_title,
        COALESCE(e.signing_file_path, d.file_path) AS document_file_path,
        d.original_filename AS document_original_filename,
        COALESCE(e.signing_file_hash_sha256, d.file_hash_sha256) AS document_hash_sha256
      FROM envelope_recipients er
      JOIN envelopes e ON e.id = er.envelope_id
      JOIN documents d ON d.id = e.document_id
      JOIN users sender ON sender.id = e.sender_id
      WHERE er.access_token = $1
      LIMIT 1
    `,
    [token]
  );

  const session = result.rows[0];
  if (!session) {
    throw new ApiError(404, "Link tanda tangan tidak ditemukan.");
  }

  if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
    throw new ApiError(400, "Link tanda tangan sudah kedaluwarsa.");
  }

  ensureEnvelopeIsSignable(session);

  return session;
}

export async function getPublicSigningSession(token: string): Promise<PublicSigningSession> {
  const session = await getSessionByToken(token);

  const recipientsResult = await query<DbRecipientProgressRow>(
    `
      SELECT id, user_id, email, name, role, status, signing_order, access_token
      FROM envelope_recipients
      WHERE envelope_id = $1
      ORDER BY signing_order ASC
    `,
    [session.envelope_id]
  );

  enforceSequentialSigning(session.sequential_signing, session.recipient_id, recipientsResult.rows);

  if (session.recipient_status !== "signed") {
    await query(
      `
        UPDATE envelope_recipients
        SET status = CASE
          WHEN status IN ('pending', 'notified') THEN 'opened'
          ELSE status
        END
        WHERE id = $1
      `,
      [session.recipient_id]
    );

    await query(
      `
        INSERT INTO audit_logs (envelope_id, user_id, action, metadata)
        VALUES ($1, $2, 'opened', $3)
      `,
      [session.envelope_id, session.recipient_user_id, { recipientId: session.recipient_id }]
    );
  }

  const fieldsResult = await query<DbFieldRow>(
    `
      SELECT
        id,
        envelope_id,
        recipient_id,
        field_type,
        page_number,
        position_x,
        position_y,
        width,
        height,
        required,
        value,
        filled_at
      FROM envelope_fields
      WHERE envelope_id = $1
        AND (recipient_id = $2 OR recipient_id IS NULL)
      ORDER BY page_number ASC, id ASC
    `,
    [session.envelope_id, session.recipient_id]
  );

  return {
    envelope: {
      id: session.envelope_id,
      title: session.envelope_title,
      message: session.envelope_message,
      status: session.envelope_status,
      sequentialSigning: session.sequential_signing,
      expiresAt: toIsoString(session.expires_at)
    },
    document: {
      id: session.document_id,
      title: session.document_title,
      originalFilename: session.document_original_filename
    },
    recipient: {
      id: session.recipient_id,
      email: session.recipient_email,
      name: session.recipient_name,
      role: session.recipient_role,
      status: session.recipient_status,
      signingOrder: session.recipient_signing_order
    },
    fields: fieldsResult.rows.map(mapField)
  };
}

export async function getPublicSigningDocument(token: string): Promise<{
  absolutePath: string;
  originalFilename: string;
}> {
  const session = await getSessionByToken(token);
  const absolutePath = path.resolve(process.cwd(), session.document_file_path);

  try {
    await fs.access(absolutePath);
  } catch {
    throw new ApiError(404, "Dokumen untuk link signing tidak ditemukan.");
  }

  return {
    absolutePath,
    originalFilename: session.document_original_filename
  };
}

export async function completePublicSigning(payload: SigningPayload): Promise<SigningResult> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const sessionResult = await client.query<DbSigningSessionRow>(
      `
        SELECT
          er.id AS recipient_id,
          er.user_id AS recipient_user_id,
          er.email AS recipient_email,
          er.name AS recipient_name,
          er.role AS recipient_role,
          er.status AS recipient_status,
          er.signing_order AS recipient_signing_order,
          er.access_token,
          e.id AS envelope_id,
          e.title AS envelope_title,
          e.message AS envelope_message,
          e.status AS envelope_status,
          e.sequential_signing,
          e.expires_at,
          e.sender_id,
          sender.full_name AS sender_name,
          sender.email AS sender_email,
          d.id AS document_id,
          d.title AS document_title,
          COALESCE(e.signing_file_path, d.file_path) AS document_file_path,
          d.original_filename AS document_original_filename,
          COALESCE(e.signing_file_hash_sha256, d.file_hash_sha256) AS document_hash_sha256
        FROM envelope_recipients er
        JOIN envelopes e ON e.id = er.envelope_id
        JOIN documents d ON d.id = e.document_id
        JOIN users sender ON sender.id = e.sender_id
        WHERE er.access_token = $1
        LIMIT 1
        FOR UPDATE OF er, e, d
      `,
      [payload.token]
    );

    const session = sessionResult.rows[0];
    if (!session) {
      throw new ApiError(404, "Link tanda tangan tidak ditemukan.");
    }

    ensureEnvelopeIsSignable(session);
    ensureRecipientCanSign(session);

    if (session.recipient_status === "signed") {
      throw new ApiError(400, "Dokumen sudah ditandatangani oleh penerima ini.");
    }

    const recipientsResult = await client.query<DbRecipientProgressRow>(
      `
        SELECT id, user_id, email, name, role, status, signing_order, access_token
        FROM envelope_recipients
        WHERE envelope_id = $1
        ORDER BY signing_order ASC
        FOR UPDATE
      `,
      [session.envelope_id]
    );

    enforceSequentialSigning(session.sequential_signing, session.recipient_id, recipientsResult.rows);

    const fieldRowsResult = await client.query<DbFieldRow>(
      `
        SELECT
          id,
          envelope_id,
          recipient_id,
          field_type,
          page_number,
          position_x,
          position_y,
          width,
          height,
          required,
          value,
          filled_at
        FROM envelope_fields
        WHERE envelope_id = $1
          AND (recipient_id = $2 OR recipient_id IS NULL)
        FOR UPDATE
      `,
      [session.envelope_id, session.recipient_id]
    );

    const fieldsById = new Map(fieldRowsResult.rows.map((field) => [field.id, field]));

    const payloadFieldIds = new Set<string>();
    for (const inputField of payload.fields) {
      if (payloadFieldIds.has(inputField.fieldId)) {
        throw new ApiError(400, `Field ${inputField.fieldId} dikirim lebih dari satu kali.`);
      }

      payloadFieldIds.add(inputField.fieldId);
    }

    for (const field of fieldRowsResult.rows) {
      if (!field.required || field.value) {
        continue;
      }

      if (!payloadFieldIds.has(field.id)) {
        throw new ApiError(400, `Field ${field.id} wajib diisi.`);
      }
    }

    const updatedFields: DbFieldRow[] = [];
    for (const inputField of payload.fields) {
      const field = fieldsById.get(inputField.fieldId);
      if (!field) {
        throw new ApiError(400, "Terdapat field yang tidak valid pada payload.");
      }

      let nextValue = inputField.value ?? null;

      if ((field.field_type === "signature" || field.field_type === "initial") && !nextValue) {
        nextValue = payload.signature?.value ?? null;
      }

      if (field.field_type === "date" && !nextValue) {
        nextValue = new Date().toISOString().slice(0, 10);
      }

      if (field.field_type === "checkbox" && !nextValue) {
        nextValue = "true";
      }

      if (field.required && !nextValue) {
        throw new ApiError(400, `Field ${field.id} wajib diisi.`);
      }

      const updateResult = await client.query<DbFieldRow>(
        `
          UPDATE envelope_fields
          SET value = $2,
              filled_at = NOW()
          WHERE id = $1
          RETURNING
            id,
            envelope_id,
            recipient_id,
            field_type,
            page_number,
            position_x,
            position_y,
            width,
            height,
            required,
            value,
            filled_at
        `,
        [field.id, nextValue]
      );

      const updated = updateResult.rows[0];
      if (updated) {
        updatedFields.push(updated);
      }
    }

    if (updatedFields.length === 0) {
      throw new ApiError(400, "Tidak ada field yang diisi untuk ditandatangani.");
    }

    const sourceAbsolutePath = path.resolve(process.cwd(), session.document_file_path);
    const signedRelativePath = path
      .join(env.UPLOAD_DIR, "signed", session.envelope_id, `${Date.now()}-${session.recipient_id}.pdf`)
      .replace(/\\/g, "/");
    const signedAbsolutePath = path.resolve(process.cwd(), signedRelativePath);

    const signedAtIso = new Date().toISOString();
    const isPdfSource =
      session.document_original_filename.toLowerCase().endsWith(".pdf") ||
      session.document_file_path.toLowerCase().endsWith(".pdf");

    if (isPdfSource) {
      await applySignatureFieldsToPdf({
        sourcePath: sourceAbsolutePath,
        outputPath: signedAbsolutePath,
        signerName: session.recipient_name,
        signedAtIso,
        fields: updatedFields.map((field) => ({
          pageNumber: field.page_number,
          positionX: field.position_x,
          positionY: field.position_y,
          width: field.width,
          height: field.height,
          label: field.value ?? `Signed by ${session.recipient_name}`
        }))
      });
    } else {
      await fs.mkdir(path.dirname(signedAbsolutePath), { recursive: true });
      await fs.copyFile(sourceAbsolutePath, signedAbsolutePath);
    }

    const signedFileBytes = await fs.readFile(signedAbsolutePath);
    const documentHashBefore = session.document_hash_sha256;
    const documentHashAfter = createHash("sha256").update(signedFileBytes).digest("hex");

    await client.query(
      `
        UPDATE envelope_recipients
        SET status = 'signed',
            signed_at = NOW()
        WHERE id = $1
      `,
      [session.recipient_id]
    );

    for (const field of updatedFields) {
      await client.query(
        `
          INSERT INTO signing_actions (
            recipient_id,
            envelope_field_id,
            ip_address,
            user_agent,
            document_hash_before,
            document_hash_after
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          session.recipient_id,
          field.id,
          payload.ipAddress ?? null,
          payload.userAgent ?? null,
          documentHashBefore,
          documentHashAfter
        ]
      );
    }

    const currentStatuses = recipientsResult.rows.map((recipient) => {
      if (recipient.id === session.recipient_id) {
        return { ...recipient, status: "signed" };
      }

      return recipient;
    });

    const pendingSigners = currentStatuses.filter(
      (recipient) => recipient.role === "signer" && recipient.status !== "signed" && recipient.status !== "declined"
    );

    let envelopeStatus = "in_progress";
    let completed = false;
    let notifiedRecipients: DbRecipientProgressRow[] = [];

    if (pendingSigners.length === 0) {
      envelopeStatus = "completed";
      completed = true;

      await client.query(
        `
          UPDATE envelopes
          SET status = 'completed',
              completed_at = NOW(),
              updated_at = NOW(),
              signing_file_path = $2,
              signing_file_hash_sha256 = $3
          WHERE id = $1
        `,
        [session.envelope_id, signedRelativePath, documentHashAfter]
      );

      await client.query(
        `
          UPDATE documents
          SET file_path = $2,
              file_hash_sha256 = $3
          WHERE id = $1
        `,
        [session.document_id, signedRelativePath, documentHashAfter]
      );
    } else {
      await client.query(
        `
          UPDATE envelopes
          SET status = 'in_progress',
              updated_at = NOW(),
              signing_file_path = $2,
              signing_file_hash_sha256 = $3
          WHERE id = $1
        `,
        [session.envelope_id, signedRelativePath, documentHashAfter]
      );

      if (session.sequential_signing) {
        const nextRecipient = pendingSigners[0];

        await client.query(
          `
            UPDATE envelope_recipients
            SET status = 'notified'
            WHERE id = $1 AND status IN ('pending', 'opened')
          `,
          [nextRecipient.id]
        );

        notifiedRecipients = [nextRecipient];
      } else {
        notifiedRecipients = pendingSigners;

        await client.query(
          `
            UPDATE envelope_recipients
            SET status = 'notified'
            WHERE envelope_id = $1
              AND role = 'signer'
              AND status IN ('pending', 'opened')
          `,
          [session.envelope_id]
        );
      }
    }

    await syncDocumentWorkflowStatus(client, session.document_id);

    await client.query(
      `
        INSERT INTO audit_logs (envelope_id, user_id, action, ip_address, user_agent, metadata)
        VALUES ($1, $2, 'signed', $3, $4, $5)
      `,
      [session.envelope_id, session.recipient_user_id, payload.ipAddress ?? null, payload.userAgent ?? null, {
        recipientEmail: session.recipient_email,
        fieldCount: updatedFields.length
      }]
    );

    await client.query("COMMIT");

    for (const recipient of notifiedRecipients) {
      const signUrl = buildSignUrl(recipient.access_token);

      if (recipient.user_id) {
        try {
          await createNotification({
            userId: recipient.user_id,
            type: "signing_request",
            title: `Permintaan tanda tangan: ${session.envelope_title}`,
            body: `Dokumen ${session.envelope_title} menunggu tanda tangan Anda.`,
            actionUrl: `/sign/${recipient.access_token}`
          });
        } catch {
          // Notification delivery should not fail signing response.
        }
      }

      try {
        await sendSigningRequestEmail({
          to: recipient.email,
          recipientName: recipient.name,
          envelopeTitle: session.envelope_title,
          signUrl
        });
      } catch {
        // Email delivery should not fail signing transaction.
      }
    }

    if (completed) {
      try {
        await createNotification({
          userId: session.sender_id,
          type: "completed",
          title: `Dokumen selesai: ${session.envelope_title}`,
          body: "Semua penandatangan sudah menyelesaikan proses.",
          actionUrl: `/dashboard/documents`
        });
      } catch {
        // Notification delivery should not fail signing response.
      }

      try {
        await sendEnvelopeCompletedEmail({
          to: session.sender_email,
          senderName: session.sender_name,
          envelopeTitle: session.envelope_title
        });
      } catch {
        // Email delivery should not fail response.
      }
    }

    return {
      envelopeId: session.envelope_id,
      envelopeStatus,
      completed
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
