import { Server, Socket } from 'socket.io';
import type { NotificationItem } from '../../../shared/types/notification';

// Events that the server emits to the client
export interface ServerToClientEvents {
  'new-notification': (notif: NotificationItem) => void;
  // add others if needed later
}

// Events that the client emits to the server
export interface ClientToServerEvents {
  'register-user': (username: string) => void;
  // add others like 'send-message' or 'join-room'
}

// Strongly typed Socket.IO Server and Socket aliases
export type FakeSOSocket = Server<ClientToServerEvents, ServerToClientEvents>;
export type FakeSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
