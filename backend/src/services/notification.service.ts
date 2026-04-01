import { query } from "../config/database";
import { emitToUser } from "../config/socket";
import { ApiError } from "../middleware/error.middleware";

type DbNotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  action_url: string | null;
  is_read: boolean;
  created_at: Date | string;
};

export type NotificationRecord = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
};

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapNotification(row: DbNotificationRow): NotificationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    actionUrl: row.action_url,
    isRead: row.is_read,
    createdAt: toIsoString(row.created_at)
  };
}

export async function createNotification(input: {
  userId: string;
  type: "signing_request" | "signed" | "completed" | "reminder" | "system";
  title: string;
  body: string;
  actionUrl?: string;
}): Promise<NotificationRecord> {
  const result = await query<DbNotificationRow>(
    `
      INSERT INTO notifications (user_id, type, title, body, action_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        user_id,
        type,
        title,
        body,
        action_url,
        is_read,
        created_at
    `,
    [input.userId, input.type, input.title, input.body, input.actionUrl ?? null]
  );

  const notification = result.rows[0];
  if (!notification) {
    throw new ApiError(500, "Gagal membuat notifikasi.");
  }

  const mapped = mapNotification(notification);
  emitToUser(input.userId, "notification:new", mapped);

  return mapped;
}

export async function listUserNotifications(userId: string, limit = 20): Promise<NotificationRecord[]> {
  const result = await query<DbNotificationRow>(
    `
      SELECT
        id,
        user_id,
        type,
        title,
        body,
        action_url,
        is_read,
        created_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, limit]
  );

  return result.rows.map(mapNotification);
}

export async function markNotificationAsRead(userId: string, notificationId: string): Promise<NotificationRecord> {
  const result = await query<DbNotificationRow>(
    `
      UPDATE notifications
      SET is_read = TRUE
      WHERE id = $1 AND user_id = $2
      RETURNING
        id,
        user_id,
        type,
        title,
        body,
        action_url,
        is_read,
        created_at
    `,
    [notificationId, userId]
  );

  const notification = result.rows[0];
  if (!notification) {
    throw new ApiError(404, "Notifikasi tidak ditemukan.");
  }

  const mapped = mapNotification(notification);
  emitToUser(userId, "notification:read", mapped);

  return mapped;
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  await query(
    `
      UPDATE notifications
      SET is_read = TRUE
      WHERE user_id = $1
    `,
    [userId]
  );

  emitToUser(userId, "notification:all-read", { userId });
}
