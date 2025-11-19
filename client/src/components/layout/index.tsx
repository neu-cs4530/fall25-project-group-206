import './index.css';
import { Outlet } from 'react-router-dom';
import SideBarNav from '../main/sideBarNav';
import Header from '../header';
import useSessionTimeout from '../../hooks/useSessionTimeout';

/**
 * Main component represents the layout of the main page, including a sidebar and the main content area.
 */
const Layout = () => {
  useSessionTimeout(30); // Call the hook here - 30 minutes of inactivity

  return (
    <>
      <Header />
      <div id='main' className='main'>
        <SideBarNav />
        <div id='right_main' className='right_main'>
          <Outlet />
        </div>
      </div>
    </>
  );
};

export default Layout;
