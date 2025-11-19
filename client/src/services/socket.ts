// client/src/services/socket.ts
import { io, Socket } from 'socket.io-client';
import api from './config';

// Try to derive the backend base URL from the existing axios instance.
// In dev this will usually be '/api', which we strip to '' so that
// Socket.IO connects to the front-end origin (Vite), and Vite proxies
// /socket.io to the backend.
let backendBaseUrl: string;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const axiosBase = (api as any).defaults?.baseURL as string | undefined;

if (axiosBase) {
  // Strip trailing "/api" if present so sockets hit the root server / front-end origin.
  // '/api'  -> ''
  // 'https://site.com/api' -> 'https://site.com'
  backendBaseUrl = axiosBase.replace(/\/api\/?$/, '');
} else {
  // Fallbacks in case baseURL is not set for some reason
  backendBaseUrl =
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_API_BASE_URL?.replace(/\/api\/?$/, '') ||
    'http://localhost:8000';
}

// Single shared Socket.IO client for the app
export const socket: Socket = io(backendBaseUrl, {
  path: '/socket.io',
  withCredentials: true,
});

export default socket;
