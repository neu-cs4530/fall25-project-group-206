import { useNavigate } from 'react-router-dom';
import useHeader from '../../hooks/useHeader';
import './index.css';
import useUserContext from '../../hooks/useUserContext';

/**
 * Header component that renders the main title and a search bar.
 * The search bar allows the user to input a query and navigate to the search results page
 * when they press Enter.
 */
const Header = () => {
  const { val, handleInputChange, handleKeyDown, handleSignOut } = useHeader();
  const { user: currentUser } = useUserContext();
  const navigate = useNavigate();

  return (
    <div id='header' className='header'>
      <div className='title' onClick={() => navigate('/home')}>
        Fake Stack Overflow
      </div>

      <input
        id='searchBar'
        placeholder='Search questions, tags, users...'
        type='text'
        value={val}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
      />

      <div className='header-buttons'>
        <button
          className='view-profile-button'
          onClick={() => navigate(`/user/${currentUser.username}`)}>
          Profile
        </button>
        <button onClick={handleSignOut} className='logout-button'>
          Log Out
        </button>
      </div>
    </div>
  );
};

export default Header;
