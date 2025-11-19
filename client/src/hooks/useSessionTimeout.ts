import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useUserContext from './useUserContext';
import useLoginContext from './useLoginContext';

/**
 * Hook to handle session timeout on user inactivity.
 * Logs out user after specified inactive period.
 *
 * @param inactivityMinutes - Minutes of inactivity before logout (default: 30)
 */
const useSessionTimeout = (inactivityMinutes: number = 30) => {
  const navigate = useNavigate();
  const { user } = useUserContext();
  const { setUser } = useLoginContext();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) return; // Only track if user is logged in

    const inactivityMs = inactivityMinutes * 60 * 1000;

    /**
     * Handles session expiration by logging out the user
     */
    const handleSessionExpired = () => {
      setUser(null);
      localStorage.removeItem('token');
      navigate('/', {
        state: { message: 'Your session has expired due to inactivity. Please log in again.' },
      });
    };

    /**
     * Resets the inactivity timer on user activity
     */
    const resetTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(handleSessionExpired, inactivityMs);
    };

    /**
     * Events that count as user activity
     */
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    // Initial timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [user, inactivityMinutes, navigate, setUser]);
};

export default useSessionTimeout;
