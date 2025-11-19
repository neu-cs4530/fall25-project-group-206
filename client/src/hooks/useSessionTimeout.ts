import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useUserContext from './useUserContext';
import useLoginContext from './useLoginContext';

/**
 * Hook to handle session timeout with warning modal.
 * Shows a warning modal before logging out the user.
 *
 * @param inactivityMinutes - Total minutes of inactivity before logout (default: 30)
 * @param warningMinutes - Minutes before logout to show warning modal (default: 2)
 * @returns Object with modal state and handler
 */
const useSessionTimeout = (inactivityMinutes: number = 30, warningMinutes: number = 2) => {
  const navigate = useNavigate();
  const { user } = useUserContext();
  const { setUser } = useLoginContext();
  const [showModal, setShowModal] = useState(false);
  const [countdown, setCountdown] = useState(warningMinutes * 60);
  type TimeoutHandle = ReturnType<typeof setTimeout>;
  type IntervalHandle = ReturnType<typeof setInterval>;

  const timeoutRef = useRef<TimeoutHandle | null>(null);
  const warningTimeoutRef = useRef<TimeoutHandle | null>(null);
  const countdownIntervalRef = useRef<IntervalHandle | null>(null);

  useEffect(() => {
    if (!user) return; // Only track if user is logged in

    const inactivityMs = inactivityMinutes * 60 * 1000;
    const warningMs = warningMinutes * 60 * 1000;

    /**
     * Handles session expiration by logging out the user
     */
    const handleLogout = () => {
      setUser(null);
      navigate('/');
    };

    /**
     * Starts the countdown timer for the warning modal
     */
    const startCountdown = () => {
      setCountdown(warningMinutes * 60);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    /**
     * Shows the warning modal and starts the final countdown
     */
    const showWarning = () => {
      setShowModal(true);
      startCountdown();
      timeoutRef.current = setTimeout(handleLogout, warningMs);
    };

    /**
     * Resets the inactivity timer on user activity
     */
    const resetTimer = () => {
      // Clear all existing timers
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }

      // Hide modal if showing
      setShowModal(false);

      // Set new warning timer (show warning X minutes before actual logout)
      warningTimeoutRef.current = setTimeout(showWarning, inactivityMs - warningMs);
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
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [user, inactivityMinutes, warningMinutes, navigate, setUser]);

  /**
   * Handler for "Stay Logged In" button
   * Resets all timers and closes the modal
   */
  const handleStayLoggedIn = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    setShowModal(false);

    // Trigger a reset by simulating activity
    window.dispatchEvent(new Event('mousedown'));
  };

  return { showModal, countdown, handleStayLoggedIn };
};

export default useSessionTimeout;
