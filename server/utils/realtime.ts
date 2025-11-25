// server/utils/realtime.ts
import type { FakeSOSocket } from '../types/types';

let io: FakeSOSocket | null = null;

/**
 * Called once at server startup so this module can access the socket server.
 */
export function registerSocketServer(socketServer: FakeSOSocket): void {
  io = socketServer;
}

/**
 * Ping clients that a given user has new notifications.
 *
 * This is *notification-only*: the client will refetch the feed from the API.
 */
export default function emitNotification(username: string): void {
  if (!io) {
    return;
  }

  io.emit('notificationPing', { username });
}
