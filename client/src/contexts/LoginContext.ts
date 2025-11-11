import { createContext } from 'react';
import { SafeDatabaseUser, FakeSOSocket } from '../types/types';

/**
 * Interface representing the context type for user and socket management.
 *
 * - setUser: updates the current logged-in user (or null if logged out)
 * - setSocket: updates the active socket connection
 */
export interface LoginContextType {
  setUser: (user: SafeDatabaseUser | null) => void;
  setSocket: (socket: FakeSOSocket | null) => void;
}

const LoginContext = createContext<LoginContextType | null>(null);

export default LoginContext;
