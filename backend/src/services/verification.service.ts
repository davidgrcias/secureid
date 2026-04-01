import { query } from "../config/database";
import { ApiError } from "../middleware/error.middleware";

type VerificationType = "ktp_photo" | "selfie" | "liveness";
type VerificationStatus = "pending" | "processing" | "verified" | "failed";

type DbVerificationRow = {
  id: string;
  user_id: string;
  type: VerificationType;
  file_path: string | null;
  status: VerificationStatus;
  result_data: Record<string, unknown>;
  failure_reason: string | null;
  created_at: Date | string;
};

export type VerificationRecord = {
  id: string;
  userId: string;
  type: VerificationType;
  filePath: string | null;
  status: VerificationStatus;
  resultData: Record<string, unknown>;
  failureReason: string | null;
  createdAt: string;
};

export type VerificationOverview = {
  latestByType: Partial<Record<VerificationType, VerificationRecord>>;
  records: VerificationRecord[];
  kycStatus: "unverified" | "pending" | "verified" | "rejected";
};

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapVerification(row: DbVerificationRow): VerificationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    filePath: row.file_path,
    status: row.status,
    resultData: row.result_data,
    failureReason: row.failure_reason,
    createdAt: toIsoString(row.created_at)
  };
}

async function createVerificationRecord(input: {
  userId: string;
  type: VerificationType;
  filePath?: string;
  status: VerificationStatus;
  resultData?: Record<string, unknown>;
  failureReason?: string;
}): Promise<VerificationRecord> {
  const result = await query<DbVerificationRow>(
    `
      INSERT INTO verification_records (user_id, type, file_path, status, result_data, failure_reason)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, user_id, type, file_path, status, result_data, failure_reason, created_at
    `,
    [
      input.userId,
      input.type,
      input.filePath ?? null,
      input.status,
      input.resultData ?? {},
      input.failureReason ?? null
    ]
  );

  const row = result.rows[0];
  if (!row) {
    throw new ApiError(500, "Gagal menyimpan record verifikasi.");
  }

  return mapVerification(row);
}

async function syncUserKycStatus(userId: string): Promise<"unverified" | "pending" | "verified" | "rejected"> {
  const latestResult = await query<DbVerificationRow>(
    `
      SELECT id, user_id, type, file_path, status, result_data, failure_reason, created_at
      FROM verification_records
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [userId]
  );

  const latestByType = new Map<VerificationType, VerificationStatus>();
  for (const row of latestResult.rows) {
    if (!latestByType.has(row.type)) {
      latestByType.set(row.type, row.status);
    }
  }

  const ktpStatus = latestByType.get("ktp_photo");
  const selfieStatus = latestByType.get("selfie");
  const livenessStatus = latestByType.get("liveness");

  let nextKycStatus: "unverified" | "pending" | "verified" | "rejected" = "unverified";

  if (ktpStatus || selfieStatus || livenessStatus) {
    nextKycStatus = "pending";
  }

  if (ktpStatus === "failed" || selfieStatus === "failed" || livenessStatus === "failed") {
    nextKycStatus = "rejected";
  } else if (ktpStatus === "verified" && selfieStatus === "verified" && livenessStatus === "verified") {
    nextKycStatus = "verified";
  }

  await query(
    `
      UPDATE users
      SET kyc_status = $2,
          updated_at = NOW()
      WHERE id = $1
    `,
    [userId, nextKycStatus]
  );

  return nextKycStatus;
}

export async function uploadVerificationFile(input: {
  userId: string;
  type: "ktp_photo" | "selfie";
  filePath: string;
  metadata?: Record<string, unknown>;
}): Promise<VerificationRecord> {
  const record = await createVerificationRecord({
    userId: input.userId,
    type: input.type,
    filePath: input.filePath,
    status: "verified",
    resultData: {
      source: "file_upload",
      ...(input.metadata ?? {})
    }
  });

  await syncUserKycStatus(input.userId);
  return record;
}

export async function submitLivenessVerification(input: {
  userId: string;
  passed: boolean;
  steps: string[];
  score?: number;
}): Promise<VerificationRecord> {
  const record = await createVerificationRecord({
    userId: input.userId,
    type: "liveness",
    status: input.passed ? "verified" : "failed",
    resultData: {
      source: "liveness_check",
      steps: input.steps,
      score: input.score ?? null
    },
    failureReason: input.passed ? undefined : "Liveness check tidak memenuhi syarat."
  });

  await syncUserKycStatus(input.userId);
  return record;
}

export async function getVerificationOverview(userId: string): Promise<VerificationOverview> {
  const [recordsResult, userResult] = await Promise.all([
    query<DbVerificationRow>(
      `
        SELECT id, user_id, type, file_path, status, result_data, failure_reason, created_at
        FROM verification_records
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 30
      `,
      [userId]
    ),
    query<{ kyc_status: "unverified" | "pending" | "verified" | "rejected" }>(
      `
        SELECT kyc_status
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [userId]
    )
  ]);

  const records = recordsResult.rows.map(mapVerification);

  const latestByType: Partial<Record<VerificationType, VerificationRecord>> = {};
  for (const record of records) {
    if (!latestByType[record.type]) {
      latestByType[record.type] = record;
    }
  }

  return {
    latestByType,
    records,
    kycStatus: userResult.rows[0]?.kyc_status ?? "unverified"
  };
}
