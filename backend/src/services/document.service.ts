import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { query } from "../config/database";
import { ApiError } from "../middleware/error.middleware";

type DbDocumentRow = {
  id: string;
  uploader_id: string;
  title: string;
  description: string | null;
  original_filename: string;
  file_path: string;
  file_hash_sha256: string;
  file_size_bytes: number;
  page_count: number | null;
  status: string;
  created_at: Date | string;
};

export type DocumentRecord = {
  id: string;
  uploaderId: string;
  title: string;
  description: string | null;
  originalFilename: string;
  filePath: string;
  fileHashSha256: string;
  fileSizeBytes: number;
  pageCount: number | null;
  status: string;
  createdAt: string;
};

function mapDocument(row: DbDocumentRow): DocumentRecord {
  return {
    id: row.id,
    uploaderId: row.uploader_id,
    title: row.title,
    description: row.description,
    originalFilename: row.original_filename,
    filePath: row.file_path,
    fileHashSha256: row.file_hash_sha256,
    fileSizeBytes: row.file_size_bytes,
    pageCount: row.page_count,
    status: row.status,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString()
  };
}

export async function createDocumentRecord(input: {
  uploaderId: string;
  title?: string;
  description?: string;
  file: Express.Multer.File;
}): Promise<DocumentRecord> {
  const fileBuffer = await fs.readFile(input.file.path);
  const fileHashSha256 = createHash("sha256").update(fileBuffer).digest("hex");
  const filePath = path.relative(process.cwd(), input.file.path).replace(/\\/g, "/");

  const result = await query<DbDocumentRow>(
    `
      INSERT INTO documents (
        uploader_id,
        title,
        description,
        original_filename,
        file_path,
        file_hash_sha256,
        file_size_bytes,
        page_count,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'uploaded')
      RETURNING
        id,
        uploader_id,
        title,
        description,
        original_filename,
        file_path,
        file_hash_sha256,
        file_size_bytes,
        page_count,
        status,
        created_at
    `,
    [
      input.uploaderId,
      input.title?.trim() || input.file.originalname,
      input.description?.trim() || null,
      input.file.originalname,
      filePath,
      fileHashSha256,
      input.file.size,
      null
    ]
  );

  const document = result.rows[0];
  if (!document) {
    throw new ApiError(500, "Gagal menyimpan metadata dokumen.");
  }

  return mapDocument(document);
}

export async function listUserDocuments(input: {
  userId: string;
  page: number;
  limit: number;
  status?: string;
}): Promise<{ items: DocumentRecord[]; total: number }> {
  const offset = (input.page - 1) * input.limit;

  const [itemsResult, countResult] = await Promise.all([
    query<DbDocumentRow>(
      `
        SELECT
          id,
          uploader_id,
          title,
          description,
          original_filename,
          file_path,
          file_hash_sha256,
          file_size_bytes,
          page_count,
          status,
          created_at
        FROM documents
        WHERE uploader_id = $1
          AND ($2::text IS NULL OR status = $2)
        ORDER BY created_at DESC
        LIMIT $3
        OFFSET $4
      `,
      [input.userId, input.status ?? null, input.limit, offset]
    ),
    query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM documents
        WHERE uploader_id = $1
          AND ($2::text IS NULL OR status = $2)
      `,
      [input.userId, input.status ?? null]
    )
  ]);

  return {
    items: itemsResult.rows.map(mapDocument),
    total: Number(countResult.rows[0]?.total ?? "0")
  };
}

export async function getUserDocumentById(userId: string, documentId: string): Promise<DocumentRecord> {
  const result = await query<DbDocumentRow>(
    `
      SELECT
        id,
        uploader_id,
        title,
        description,
        original_filename,
        file_path,
        file_hash_sha256,
        file_size_bytes,
        page_count,
        status,
        created_at
      FROM documents
      WHERE id = $1 AND uploader_id = $2
      LIMIT 1
    `,
    [documentId, userId]
  );

  const document = result.rows[0];
  if (!document) {
    throw new ApiError(404, "Dokumen tidak ditemukan.");
  }

  return mapDocument(document);
}

export async function archiveUserDocument(userId: string, documentId: string): Promise<void> {
  const result = await query<{ id: string }>(
    `
      UPDATE documents
      SET status = 'archived'
      WHERE id = $1 AND uploader_id = $2
      RETURNING id
    `,
    [documentId, userId]
  );

  if (!result.rows[0]) {
    throw new ApiError(404, "Dokumen tidak ditemukan.");
  }
}
