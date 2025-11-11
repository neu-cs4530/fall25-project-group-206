import { useEffect, useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { io } from 'socket.io-client';
import FakeStackOverflow from './components/fakestackoverflow';
import { FakeSOSocket } from './types/types';
import { NotificationProvider } from './contexts/NotificationContext';
import useUserContext from './hooks/useUserContext';

// ensures socket connections work properly in production as well
const SERVER_URL: string | undefined = import.meta.env.VITE_SERVER_URL || 'http://localhost:8000';

const App = () => {
  const [socket, setSocket] = useState<FakeSOSocket | null>(null);
  const { user } = useUserContext(); // gives us user.username after login or restore

  /**
   * 1️⃣ Create the socket connection once when the app loads.
   */
  useEffect(() => {
    // ✅ Only connect after user logs in
    if (!user) return;

    const newSocket = io(SERVER_URL, {
      path: '/socket.io',
      withCredentials: true,
    });

    setSocket(newSocket);
    console.log('🔌 Socket connected for', user.username);

    return () => {
      console.log('🧹 Disconnecting socket for', user.username);
      newSocket.disconnect();
    };
  }, [user]);

  /**
   * Register the user once we have both the socket and username.
   * Also re-register whenever the socket reconnects (e.g. after a network blip).
   */
  useEffect(() => {
    if (!socket || !user?.username) return;

    const handleConnect = () => {
      console.log(`📡 Registering user with socket: ${user.username}`);
      socket.emit('register-user', user.username);
    };

    // register immediately if already connected
    if (socket.connected) {
      handleConnect();
    }

    // re-register automatically on reconnect
    socket.on('connect', handleConnect);

    return () => {
      socket.off('connect', handleConnect);
    };
  }, [socket, user?.username]);

  /**
   * 3️⃣ Wrap the app in NotificationProvider so global notifications can listen for events.
   */
  return (
    <Router>
      <NotificationProvider>
        <FakeStackOverflow socket={socket} />
      </NotificationProvider>
    </Router>
  );
};

export default App;
