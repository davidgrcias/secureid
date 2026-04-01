import type { PoolClient } from "pg";

export async function syncDocumentWorkflowStatus(client: PoolClient, documentId: string): Promise<void> {
  await client.query(
    `
      WITH status_snapshot AS (
        SELECT
          d.id,
          CASE
            WHEN d.status = 'archived' THEN d.status
            WHEN EXISTS (
              SELECT 1
              FROM envelopes e
              WHERE e.document_id = d.id
                AND e.status IN ('sent', 'in_progress')
            ) THEN 'processing'
            WHEN EXISTS (
              SELECT 1
              FROM envelopes e
              WHERE e.document_id = d.id
                AND e.status = 'completed'
            ) THEN 'ready'
            ELSE 'uploaded'
          END AS next_status
        FROM documents d
        WHERE d.id = $1
      )
      UPDATE documents d
      SET status = s.next_status
      FROM status_snapshot s
      WHERE d.id = s.id
        AND d.status <> s.next_status
    `,
    [documentId]
  );
}