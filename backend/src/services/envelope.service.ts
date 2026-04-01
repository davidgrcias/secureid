import { randomUUID } from "node:crypto";
import { env } from "../config/env";
import { pool, query } from "../config/database";
import { ApiError } from "../middleware/error.middleware";
import { sendSigningReminderEmail, sendSigningRequestEmail } from "./email.service";
import { createNotification } from "./notification.service";

type DbEnvelopeRow = {
  id: string;
  document_id: string;
  sender_id: string;
  title: string;
  message: string | null;
  status: string;
  sequential_signing: boolean;
  auto_reminder: boolean;
  expires_at: Date | string | null;
  completed_at: Date | string | null;
  created_at: Date | string;
};

type DbRecipientRow = {
  id: string;
  envelope_id: string;
  user_id: string | null;
  email: string;
  name: string;
  signing_order: number;
  role: string;
  status: string;
  access_token: string;
  signed_at: Date | string | null;
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

type DbAuditRow = {
  id: string;
  envelope_id: string;
  user_id: string | null;
  action: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: Date | string;
};

export type EnvelopeRecipientInput = {
  email: string;
  name: string;
  role?: "signer" | "viewer" | "approver";
  signingOrder?: number;
};

export type EnvelopeFieldInput = {
  recipientId?: string;
  fieldType: "signature" | "initial" | "date" | "text" | "checkbox";
  pageNumber: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  required?: boolean;
  value?: string;
};

export type EnvelopeRecord = {
  id: string;
  documentId: string;
  senderId: string;
  title: string;
  message: string | null;
  status: string;
  sequentialSigning: boolean;
  autoReminder: boolean;
  expiresAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type EnvelopeRecipient = {
  id: string;
  envelopeId: string;
  userId: string | null;
  email: string;
  name: string;
  signingOrder: number;
  role: string;
  status: string;
  accessToken: string;
  signedAt: string | null;
};

export type EnvelopeField = {
  id: string;
  envelopeId: string;
  recipientId: string | null;
  fieldType: string;
  pageNumber: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  required: boolean;
  value: string | null;
  filledAt: string | null;
};

export type EnvelopeAudit = {
  id: string;
  envelopeId: string;
  userId: string | null;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNullableIsoString(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  return toIsoString(value);
}

function mapEnvelope(row: DbEnvelopeRow): EnvelopeRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    senderId: row.sender_id,
    title: row.title,
    message: row.message,
    status: row.status,
    sequentialSigning: row.sequential_signing,
    autoReminder: row.auto_reminder,
    expiresAt: toNullableIsoString(row.expires_at),
    completedAt: toNullableIsoString(row.completed_at),
    createdAt: toIsoString(row.created_at)
  };
}

function mapRecipient(row: DbRecipientRow): EnvelopeRecipient {
  return {
    id: row.id,
    envelopeId: row.envelope_id,
    userId: row.user_id,
    email: row.email,
    name: row.name,
    signingOrder: row.signing_order,
    role: row.role,
    status: row.status,
    accessToken: row.access_token,
    signedAt: toNullableIsoString(row.signed_at)
  };
}

function mapField(row: DbFieldRow): EnvelopeField {
  return {
    id: row.id,
    envelopeId: row.envelope_id,
    recipientId: row.recipient_id,
    fieldType: row.field_type,
    pageNumber: row.page_number,
    positionX: row.position_x,
    positionY: row.position_y,
    width: row.width,
    height: row.height,
    required: row.required,
    value: row.value,
    filledAt: toNullableIsoString(row.filled_at)
  };
}

function mapAudit(row: DbAuditRow): EnvelopeAudit {
  return {
    id: row.id,
    envelopeId: row.envelope_id,
    userId: row.user_id,
    action: row.action,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    metadata: row.metadata,
    createdAt: toIsoString(row.created_at)
  };
}

async function ensureEnvelopeOwnership(envelopeId: string, senderId: string): Promise<DbEnvelopeRow> {
  const result = await query<DbEnvelopeRow>(
    `
      SELECT
        id,
        document_id,
        sender_id,
        title,
        message,
        status,
        sequential_signing,
        auto_reminder,
        expires_at,
        completed_at,
        created_at
      FROM envelopes
      WHERE id = $1 AND sender_id = $2
      LIMIT 1
    `,
    [envelopeId, senderId]
  );

  const envelope = result.rows[0];
  if (!envelope) {
    throw new ApiError(404, "Envelope tidak ditemukan.");
  }

  return envelope;
}

async function createAuditLog(
  envelopeId: string,
  userId: string,
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await query(
    `
      INSERT INTO audit_logs (envelope_id, user_id, action, metadata)
      VALUES ($1, $2, $3, $4)
    `,
    [envelopeId, userId, action, metadata ?? {}]
  );
}

function buildSignUrl(accessToken: string): string {
  return `${env.CORS_ORIGIN.replace(/\/$/, "")}/sign/${accessToken}`;
}

export async function createEnvelope(input: {
  senderId: string;
  documentId: string;
  title: string;
  message?: string;
  sequentialSigning?: boolean;
  autoReminder?: boolean;
  expiresAt?: string;
  recipients: EnvelopeRecipientInput[];
}): Promise<{ envelope: EnvelopeRecord; recipients: EnvelopeRecipient[] }> {
  if (input.recipients.length === 0) {
    throw new ApiError(400, "Minimal satu penerima harus ditambahkan.");
  }

  if (!input.recipients.some((recipient) => recipient.role === "signer")) {
    throw new ApiError(400, "Minimal satu penerima dengan role signer harus ditambahkan.");
  }

  const documentResult = await query<{ id: string }>(
    `
      SELECT id
      FROM documents
      WHERE id = $1 AND uploader_id = $2
      LIMIT 1
    `,
    [input.documentId, input.senderId]
  );

  if (!documentResult.rows[0]) {
    throw new ApiError(404, "Dokumen tidak ditemukan atau bukan milik Anda.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const insertEnvelopeResult = await client.query<DbEnvelopeRow>(
      `
        INSERT INTO envelopes (
          document_id,
          sender_id,
          title,
          message,
          status,
          sequential_signing,
          auto_reminder,
          expires_at
        )
        VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7)
        RETURNING
          id,
          document_id,
          sender_id,
          title,
          message,
          status,
          sequential_signing,
          auto_reminder,
          expires_at,
          completed_at,
          created_at
      `,
      [
        input.documentId,
        input.senderId,
        input.title,
        input.message ?? null,
        input.sequentialSigning ?? true,
        input.autoReminder ?? true,
        input.expiresAt ? new Date(input.expiresAt) : null
      ]
    );

    const envelope = insertEnvelopeResult.rows[0];
    if (!envelope) {
      throw new ApiError(500, "Gagal membuat envelope.");
    }

    const recipientRows: EnvelopeRecipient[] = [];

    for (let index = 0; index < input.recipients.length; index += 1) {
      const recipient = input.recipients[index];
      const signingOrder = recipient.signingOrder ?? index + 1;

      const linkedUserResult = await client.query<{ id: string }>(
        `
          SELECT id
          FROM users
          WHERE email = $1
          LIMIT 1
        `,
        [recipient.email]
      );

      const linkedUserId = linkedUserResult.rows[0]?.id ?? null;

      const insertRecipientResult = await client.query<DbRecipientRow>(
        `
          INSERT INTO envelope_recipients (
            envelope_id,
            user_id,
            email,
            name,
            signing_order,
            role,
            status,
            access_token
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
          RETURNING
            id,
            envelope_id,
            user_id,
            email,
            name,
            signing_order,
            role,
            status,
            access_token,
            signed_at
        `,
        [
          envelope.id,
          linkedUserId,
          recipient.email,
          recipient.name,
          signingOrder,
          recipient.role ?? "signer",
          randomUUID().replace(/-/g, "")
        ]
      );

      const createdRecipient = insertRecipientResult.rows[0];
      if (createdRecipient) {
        recipientRows.push(mapRecipient(createdRecipient));
      }
    }

    await client.query(
      `
        INSERT INTO audit_logs (envelope_id, user_id, action, metadata)
        VALUES ($1, $2, 'created', $3)
      `,
      [envelope.id, input.senderId, { recipientCount: recipientRows.length }]
    );

    await client.query("COMMIT");

    return {
      envelope: mapEnvelope(envelope),
      recipients: recipientRows
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listEnvelopes(senderId: string): Promise<EnvelopeRecord[]> {
  const result = await query<DbEnvelopeRow>(
    `
      SELECT
        id,
        document_id,
        sender_id,
        title,
        message,
        status,
        sequential_signing,
        auto_reminder,
        expires_at,
        completed_at,
        created_at
      FROM envelopes
      WHERE sender_id = $1
      ORDER BY created_at DESC
    `,
    [senderId]
  );

  return result.rows.map(mapEnvelope);
}

export async function getEnvelopeDetail(
  senderId: string,
  envelopeId: string
): Promise<{ envelope: EnvelopeRecord; recipients: EnvelopeRecipient[]; fields: EnvelopeField[] }> {
  const envelope = await ensureEnvelopeOwnership(envelopeId, senderId);

  const [recipientsResult, fieldsResult] = await Promise.all([
    query<DbRecipientRow>(
      `
        SELECT
          id,
          envelope_id,
          user_id,
          email,
          name,
          signing_order,
          role,
          status,
          access_token,
          signed_at
        FROM envelope_recipients
        WHERE envelope_id = $1
        ORDER BY signing_order ASC
      `,
      [envelope.id]
    ),
    query<DbFieldRow>(
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
      `,
      [envelope.id]
    )
  ]);

  return {
    envelope: mapEnvelope(envelope),
    recipients: recipientsResult.rows.map(mapRecipient),
    fields: fieldsResult.rows.map(mapField)
  };
}

export async function updateEnvelopeDraft(
  senderId: string,
  envelopeId: string,
  input: {
    title?: string;
    message?: string;
    sequentialSigning?: boolean;
    autoReminder?: boolean;
    expiresAt?: string;
  }
): Promise<EnvelopeRecord> {
  await ensureEnvelopeOwnership(envelopeId, senderId);

  const result = await query<DbEnvelopeRow>(
    `
      UPDATE envelopes
      SET
        title = COALESCE($3, title),
        message = COALESCE($4, message),
        sequential_signing = COALESCE($5, sequential_signing),
        auto_reminder = COALESCE($6, auto_reminder),
        expires_at = COALESCE($7, expires_at)
      WHERE id = $1 AND sender_id = $2
      RETURNING
        id,
        document_id,
        sender_id,
        title,
        message,
        status,
        sequential_signing,
        auto_reminder,
        expires_at,
        completed_at,
        created_at
    `,
    [
      envelopeId,
      senderId,
      input.title ?? null,
      input.message ?? null,
      input.sequentialSigning,
      input.autoReminder,
      input.expiresAt ? new Date(input.expiresAt) : null
    ]
  );

  const envelope = result.rows[0];
  if (!envelope) {
    throw new ApiError(404, "Envelope tidak ditemukan.");
  }

  await createAuditLog(envelopeId, senderId, "viewed", { updated: true });

  return mapEnvelope(envelope);
}

export async function replaceEnvelopeFields(
  senderId: string,
  envelopeId: string,
  fields: EnvelopeFieldInput[]
): Promise<EnvelopeField[]> {
  await ensureEnvelopeOwnership(envelopeId, senderId);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM envelope_fields WHERE envelope_id = $1", [envelopeId]);

    const createdFields: EnvelopeField[] = [];

    for (const field of fields) {
      const insertResult = await client.query<DbFieldRow>(
        `
          INSERT INTO envelope_fields (
            envelope_id,
            recipient_id,
            field_type,
            page_number,
            position_x,
            position_y,
            width,
            height,
            required,
            value
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
        [
          envelopeId,
          field.recipientId ?? null,
          field.fieldType,
          field.pageNumber,
          field.positionX,
          field.positionY,
          field.width,
          field.height,
          field.required ?? true,
          field.value ?? null
        ]
      );

      if (insertResult.rows[0]) {
        createdFields.push(mapField(insertResult.rows[0]));
      }
    }

    await client.query(
      `
        INSERT INTO audit_logs (envelope_id, user_id, action, metadata)
        VALUES ($1, $2, 'viewed', $3)
      `,
      [envelopeId, senderId, { fieldCount: createdFields.length }]
    );

    await client.query("COMMIT");

    return createdFields;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function sendEnvelope(senderId: string, envelopeId: string): Promise<EnvelopeRecord> {
  const ownershipEnvelope = await ensureEnvelopeOwnership(envelopeId, senderId);

  const result = await query<DbEnvelopeRow>(
    `
      UPDATE envelopes
      SET status = 'sent'
      WHERE id = $1 AND sender_id = $2
      RETURNING
        id,
        document_id,
        sender_id,
        title,
        message,
        status,
        sequential_signing,
        auto_reminder,
        expires_at,
        completed_at,
        created_at
    `,
    [envelopeId, senderId]
  );

  const envelope = result.rows[0];
  if (!envelope) {
    throw new ApiError(404, "Envelope tidak ditemukan.");
  }

  const recipientsResult = await query<DbRecipientRow>(
    `
      SELECT
        id,
        envelope_id,
        user_id,
        email,
        name,
        signing_order,
        role,
        status,
        access_token,
        signed_at
      FROM envelope_recipients
      WHERE envelope_id = $1
      ORDER BY signing_order ASC
    `,
    [envelopeId]
  );

  const signerRecipients = recipientsResult.rows.filter((recipient) => recipient.role === "signer");
  if (signerRecipients.length === 0) {
    throw new ApiError(400, "Envelope harus memiliki minimal satu signer sebelum dikirim.");
  }
  let recipientsToNotify: DbRecipientRow[] = [];

  if (ownershipEnvelope.sequential_signing) {
    const firstSigner = signerRecipients[0];
    if (firstSigner) {
      await query(
        `
          UPDATE envelope_recipients
          SET status = CASE
            WHEN id = $2 THEN 'notified'
            WHEN status = 'pending' THEN 'pending'
            ELSE status
          END
          WHERE envelope_id = $1
        `,
        [envelopeId, firstSigner.id]
      );

      recipientsToNotify = [firstSigner];
    }
  } else {
    const notifiedResult = await query<DbRecipientRow>(
      `
        UPDATE envelope_recipients
        SET status = CASE
          WHEN role = 'signer' AND status IN ('pending', 'opened') THEN 'notified'
          ELSE status
        END
        WHERE envelope_id = $1
        RETURNING
          id,
          envelope_id,
          user_id,
          email,
          name,
          signing_order,
          role,
          status,
          access_token,
          signed_at
      `,
      [envelopeId]
    );

    recipientsToNotify = notifiedResult.rows.filter((recipient) => recipient.role === "signer" && recipient.status === "notified");
  }

  for (const recipient of recipientsToNotify) {
    if (recipient.user_id) {
      await createNotification({
        userId: recipient.user_id,
        type: "signing_request",
        title: `Permintaan tanda tangan: ${envelope.title}`,
        body: `Dokumen ${envelope.title} menunggu tanda tangan Anda.`,
        actionUrl: `/sign/${recipient.access_token}`
      });
    }

    try {
      await sendSigningRequestEmail({
        to: recipient.email,
        recipientName: recipient.name,
        envelopeTitle: envelope.title,
        signUrl: buildSignUrl(recipient.access_token)
      });
    } catch {
      // Best effort email delivery.
    }
  }

  await createAuditLog(envelopeId, senderId, "sent");

  return mapEnvelope(envelope);
}

export async function voidEnvelope(senderId: string, envelopeId: string): Promise<EnvelopeRecord> {
  await ensureEnvelopeOwnership(envelopeId, senderId);

  const result = await query<DbEnvelopeRow>(
    `
      UPDATE envelopes
      SET status = 'voided'
      WHERE id = $1 AND sender_id = $2
      RETURNING
        id,
        document_id,
        sender_id,
        title,
        message,
        status,
        sequential_signing,
        auto_reminder,
        expires_at,
        completed_at,
        created_at
    `,
    [envelopeId, senderId]
  );

  const envelope = result.rows[0];
  if (!envelope) {
    throw new ApiError(404, "Envelope tidak ditemukan.");
  }

  await createAuditLog(envelopeId, senderId, "voided");

  return mapEnvelope(envelope);
}

export async function remindEnvelope(senderId: string, envelopeId: string): Promise<void> {
  const envelope = await ensureEnvelopeOwnership(envelopeId, senderId);

  const recipientsResult = await query<DbRecipientRow>(
    `
      SELECT
        id,
        envelope_id,
        user_id,
        email,
        name,
        signing_order,
        role,
        status,
        access_token,
        signed_at
      FROM envelope_recipients
      WHERE envelope_id = $1
        AND role = 'signer'
        AND status <> 'signed'
      ORDER BY signing_order ASC
    `,
    [envelopeId]
  );

  for (const recipient of recipientsResult.rows) {
    if (recipient.user_id) {
      await createNotification({
        userId: recipient.user_id,
        type: "reminder",
        title: `Pengingat tanda tangan: ${envelope.title}`,
        body: "Dokumen masih menunggu aksi tanda tangan Anda.",
        actionUrl: `/sign/${recipient.access_token}`
      });
    }

    try {
      await sendSigningReminderEmail({
        to: recipient.email,
        recipientName: recipient.name,
        envelopeTitle: envelope.title,
        signUrl: buildSignUrl(recipient.access_token)
      });
    } catch {
      // Best effort email delivery.
    }
  }

  await createAuditLog(envelopeId, senderId, "reminded");
}

export async function getEnvelopeAuditLogs(senderId: string, envelopeId: string): Promise<EnvelopeAudit[]> {
  await ensureEnvelopeOwnership(envelopeId, senderId);

  const result = await query<DbAuditRow>(
    `
      SELECT
        id,
        envelope_id,
        user_id,
        action,
        ip_address,
        user_agent,
        metadata,
        created_at
      FROM audit_logs
      WHERE envelope_id = $1
      ORDER BY created_at DESC
    `,
    [envelopeId]
  );

  return result.rows.map(mapAudit);
}
