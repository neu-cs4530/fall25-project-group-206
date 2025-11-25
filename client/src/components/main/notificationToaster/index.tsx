// client/src/components/main/notificationToaster/index.tsx
import './index.css';
import { useNavigate } from 'react-router-dom';
import { useNotificationToast } from '../../../contexts/NotificationToastContext';

/**
 * NotificationToaster component displays active notifications as toast messages.
 * @returns JSX.Element representing the notification toaster.
 */
const NotificationToaster = () => {
  const { activeNotification, clearNotification } = useNotificationToast();
  const navigate = useNavigate();

  if (!activeNotification) {
    return null;
  }

  const { message } = activeNotification;

  const handleClick = () => {
    clearNotification();
    navigate('/notifications');
  };

  const handleClose: React.MouseEventHandler<HTMLButtonElement> = e => {
    e.stopPropagation();
    clearNotification();
  };

  return (
    <div className='notification-toast-container'>
      <div className='notification-toast' onClick={handleClick}>
        <div className='notification-toast-message'>{message}</div>
        <button
          type='button'
          className='notification-toast-close'
          onClick={handleClose}
          aria-label='Dismiss notification'>
          ×
        </button>
      </div>
    </div>
  );
};

export default NotificationToaster;
