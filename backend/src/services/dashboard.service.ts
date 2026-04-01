import { query } from "../config/database";
import { ApiError } from "../middleware/error.middleware";

type DbCountRow = {
  total: string;
};

type DbUserContextRow = {
  full_name: string;
  role: string;
  plan: string | null;
};

type DbRecentActivityRow = {
  envelope_id: string;
  document_title: string;
  signer_name: string | null;
  status: string;
  created_at: Date | string;
};

export type DashboardSummary = {
  user: {
    fullName: string;
    role: string;
    plan: string;
  };
  stats: {
    totalDocuments: number;
    totalEnvelopes: number;
    pendingSignatureRequests: number;
    myPendingActions: number;
    weeklyDocumentChangePercent: number;
  };
  recentActivities: Array<{
    envelopeId: string;
    documentTitle: string;
    signerName: string | null;
    status: string;
    createdAt: string;
  }>;
};

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNumber(input: string | undefined): number {
  if (!input) {
    return 0;
  }

  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateWeeklyChangePercent(current: number, previous: number): number {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }

  return Number((((current - previous) / previous) * 100).toFixed(2));
}

export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const [
    userContextResult,
    documentsResult,
    envelopesResult,
    pendingSignatureRequestsResult,
    myPendingActionsResult,
    currentWeekDocumentsResult,
    previousWeekDocumentsResult,
    recentActivitiesResult
  ] = await Promise.all([
    query<DbUserContextRow>(
      `
        SELECT
          u.full_name,
          u.role,
          o.plan
        FROM users u
        LEFT JOIN organizations o ON o.id = u.org_id
        WHERE u.id = $1
        LIMIT 1
      `,
      [userId]
    ),
    query<DbCountRow>(
      `
        SELECT COUNT(*)::text AS total
        FROM documents
        WHERE uploader_id = $1
      `,
      [userId]
    ),
    query<DbCountRow>(
      `
        SELECT COUNT(*)::text AS total
        FROM envelopes
        WHERE sender_id = $1
      `,
      [userId]
    ),
    query<DbCountRow>(
      `
        SELECT COUNT(*)::text AS total
        FROM envelope_recipients er
        JOIN envelopes e ON e.id = er.envelope_id
        WHERE e.sender_id = $1
          AND er.role = 'signer'
          AND er.status IN ('pending', 'notified', 'opened')
      `,
      [userId]
    ),
    query<DbCountRow>(
      `
        SELECT COUNT(*)::text AS total
        FROM envelope_recipients
        WHERE user_id = $1
          AND role = 'signer'
          AND status IN ('pending', 'notified', 'opened')
      `,
      [userId]
    ),
    query<DbCountRow>(
      `
        SELECT COUNT(*)::text AS total
        FROM documents
        WHERE uploader_id = $1
          AND created_at >= date_trunc('week', NOW())
      `,
      [userId]
    ),
    query<DbCountRow>(
      `
        SELECT COUNT(*)::text AS total
        FROM documents
        WHERE uploader_id = $1
          AND created_at >= date_trunc('week', NOW()) - interval '7 days'
          AND created_at < date_trunc('week', NOW())
      `,
      [userId]
    ),
    query<DbRecentActivityRow>(
      `
        SELECT
          e.id AS envelope_id,
          d.title AS document_title,
          next_signer.name AS signer_name,
          e.status,
          e.created_at
        FROM envelopes e
        JOIN documents d ON d.id = e.document_id
        LEFT JOIN LATERAL (
          SELECT name
          FROM envelope_recipients
          WHERE envelope_id = e.id
            AND role = 'signer'
          ORDER BY signing_order ASC
          LIMIT 1
        ) next_signer ON true
        WHERE e.sender_id = $1
        ORDER BY e.created_at DESC
        LIMIT 20
      `,
      [userId]
    )
  ]);

  const userContext = userContextResult.rows[0];
  if (!userContext) {
    throw new ApiError(404, "Pengguna tidak ditemukan.");
  }

  const totalDocuments = toNumber(documentsResult.rows[0]?.total);
  const totalEnvelopes = toNumber(envelopesResult.rows[0]?.total);
  const pendingSignatureRequests = toNumber(pendingSignatureRequestsResult.rows[0]?.total);
  const myPendingActions = toNumber(myPendingActionsResult.rows[0]?.total);
  const currentWeekDocuments = toNumber(currentWeekDocumentsResult.rows[0]?.total);
  const previousWeekDocuments = toNumber(previousWeekDocumentsResult.rows[0]?.total);

  return {
    user: {
      fullName: userContext.full_name,
      role: userContext.role,
      plan: userContext.plan ?? "free"
    },
    stats: {
      totalDocuments,
      totalEnvelopes,
      pendingSignatureRequests,
      myPendingActions,
      weeklyDocumentChangePercent: calculateWeeklyChangePercent(currentWeekDocuments, previousWeekDocuments)
    },
    recentActivities: recentActivitiesResult.rows.map((activity) => ({
      envelopeId: activity.envelope_id,
      documentTitle: activity.document_title,
      signerName: activity.signer_name,
      status: activity.status,
      createdAt: toIsoString(activity.created_at)
    }))
  };
}
