// client/src/App.tsx
import { useEffect, useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { io } from 'socket.io-client';

import FakeStackOverflow from './components/fakestackoverflow';
import type { FakeSOSocket } from './types/types';

// ensures that the socket connections work properly in production as well.
const SERVER_URL: string | undefined = import.meta.env.VITE_SERVER_URL || 'http://localhost:8000';

const App = () => {
  const [socket, setSocket] = useState<FakeSOSocket | null>(null);

  useEffect(() => {
    if (!socket) {
      const s = io(SERVER_URL, {
        path: '/socket.io',
        withCredentials: true,
      });
      setSocket(s);
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);

  return (
    <Router>
      <FakeStackOverflow socket={socket} />
    </Router>
  );
};

export default App;
