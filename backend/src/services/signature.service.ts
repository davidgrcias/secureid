import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { query } from "../config/database";
import { env } from "../config/env";
import { ApiError } from "../middleware/error.middleware";

type DbSignatureRow = {
  id: string;
  user_id: string;
  type: string;
  font_family: string | null;
  svg_data: string | null;
  image_path: string | null;
  is_default: boolean;
  created_at: Date | string;
};

export type SignatureRecord = {
  id: string;
  userId: string;
  type: string;
  fontFamily: string | null;
  svgData: string | null;
  imagePath: string | null;
  isDefault: boolean;
  createdAt: string;
};

export type SignatureInput = {
  type: "draw" | "type" | "upload";
  value: string;
  fontFamily?: string;
  isDefault?: boolean;
};

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapSignature(row: DbSignatureRow): SignatureRecord {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    fontFamily: row.font_family,
    svgData: row.svg_data,
    imagePath: row.image_path,
    isDefault: row.is_default,
    createdAt: toIsoString(row.created_at)
  };
}

async function writeSignatureImage(userId: string, dataUrl: string): Promise<string> {
  const matches = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
  if (!matches) {
    throw new ApiError(400, "Format gambar signature upload tidak valid.");
  }

  const extension = matches[1] === "jpeg" ? "jpg" : matches[1];
  const base64Data = matches[2];
  const relativePath = path.join(env.UPLOAD_DIR, "signatures", userId, `${randomUUID()}.${extension}`).replace(/\\/g, "/");
  const absolutePath = path.resolve(process.cwd(), relativePath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, Buffer.from(base64Data, "base64"));

  return relativePath;
}

export async function listUserSignatures(userId: string): Promise<SignatureRecord[]> {
  const result = await query<DbSignatureRow>(
    `
      SELECT
        id,
        user_id,
        type,
        font_family,
        svg_data,
        image_path,
        is_default,
        created_at
      FROM signatures
      WHERE user_id = $1
      ORDER BY is_default DESC, created_at DESC
    `,
    [userId]
  );

  return result.rows.map(mapSignature);
}

export async function createUserSignature(userId: string, input: SignatureInput): Promise<SignatureRecord> {
  let svgData: string | null = null;
  let imagePath: string | null = null;

  if (input.type === "upload") {
    imagePath = await writeSignatureImage(userId, input.value);
  } else {
    svgData = input.value;
  }

  if (input.isDefault) {
    await query(
      `
        UPDATE signatures
        SET is_default = FALSE
        WHERE user_id = $1
      `,
      [userId]
    );
  }

  const result = await query<DbSignatureRow>(
    `
      INSERT INTO signatures (user_id, type, font_family, svg_data, image_path, is_default)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        user_id,
        type,
        font_family,
        svg_data,
        image_path,
        is_default,
        created_at
    `,
    [userId, input.type, input.fontFamily ?? null, svgData, imagePath, input.isDefault ?? false]
  );

  const created = result.rows[0];
  if (!created) {
    throw new ApiError(500, "Gagal menyimpan signature.");
  }

  return mapSignature(created);
}
