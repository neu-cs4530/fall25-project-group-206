import './index.css';
import { Outlet, useNavigate } from 'react-router-dom';
import SideBarNav from '../main/sideBarNav';
import Header from '../header';
import useSessionTimeout from '../../hooks/useSessionTimeout';
import SessionTimeoutModal from './SessionTimeoutModal';
import useLoginContext from '../../hooks/useLoginContext';

/**
 * Main component represents the layout of the main page, including a sidebar and the main content area.
 * Handles session timeout with warning modal.
 */
const Layout = () => {
  const navigate = useNavigate();
  const { setUser } = useLoginContext();
  const { showModal, countdown, handleStayLoggedIn } = useSessionTimeout(30, 2); // 30 min timeout, 2 min warning

  const handleLogout = () => {
    setUser(null);
    navigate('/');
  };

  return (
    <>
      <Header />
      <div id='main' className='main'>
        <SideBarNav />
        <div id='right_main' className='right_main'>
          <Outlet />
        </div>
      </div>

      {/* Session Timeout Modal */}
      {showModal && (
        <SessionTimeoutModal
          countdown={countdown}
          onStayLoggedIn={handleStayLoggedIn}
          onLogout={handleLogout}
        />
      )}
    </>
  );
};

export default Layout;
