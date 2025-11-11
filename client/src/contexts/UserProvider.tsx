import React, { useState, ReactNode } from 'react';
import UserContext from './UserContext';
import { FakeSOSocket, SafeDatabaseUser } from '../types/types';

/**
 * Provides user and socket context to the entire app.
 * Works with the existing UserContext.ts (no edits needed).
 */
export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<SafeDatabaseUser | null>(null);
  const [socket, setSocket] = useState<FakeSOSocket | null>(null);

  // Define our own runtime type (not imported) to satisfy context
  type LocalUserContextType = {
    user: SafeDatabaseUser;
    socket: FakeSOSocket;
    setUser: (u: SafeDatabaseUser | null) => void;
    setSocket: (s: FakeSOSocket | null) => void;
  };

  // Cast nullable state to satisfy the strict type
  const value = {
    user: user as SafeDatabaseUser,
    socket: socket as FakeSOSocket,
    setUser,
    setSocket,
  } as LocalUserContextType;

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export default UserProvider;
