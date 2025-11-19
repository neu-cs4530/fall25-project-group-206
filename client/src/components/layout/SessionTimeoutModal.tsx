import './SessionTimeoutModal.css';

interface SessionTimeoutModalProps {
  countdown: number;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

/**
 * Modal component that displays a session timeout warning
 * Shows countdown and allows user to stay logged in or log out immediately
 */
const SessionTimeoutModal = ({ countdown, onStayLoggedIn, onLogout }: SessionTimeoutModalProps) => {
  /**
   * Formats seconds into MM:SS format
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className='session-timeout-overlay'
      onClick={e => e.stopPropagation()} // Prevent clicks from bubbling
      onMouseDown={e => e.stopPropagation()} // Prevent mousedown from bubbling
    >
      <div
        className='session-timeout-modal'
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}>
        <div className='modal-header'>
          <div className='warning-icon'>
            <svg width='24' height='24' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
              />
            </svg>
          </div>
          <div>
            <h2>Session Timeout Warning</h2>
          </div>
        </div>

        <p className='modal-message'>
          You've been inactive for a while. Your session will expire in:
        </p>

        <div className='countdown-container'>
          <div className='countdown-time'>{formatTime(countdown)}</div>
          <p className='countdown-label'>minutes remaining</p>
        </div>

        <div className='modal-buttons'>
          <button onClick={onStayLoggedIn} className='btn-primary'>
            Stay Logged In
          </button>
          <button onClick={onLogout} className='btn-secondary'>
            Log Out Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionTimeoutModal;
