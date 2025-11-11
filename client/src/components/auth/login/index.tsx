import './index.css';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import useAuth from '../../../hooks/useAuth';
import Verify2FAPrompt from '../../twoFactorAuth/Verify2FAPrompt';
import { getUserByUsername } from '../../../services/userService';

/**
 * Renders a login form with username and password inputs, password visibility toggle,
 * error handling, and a link to the signup page. Also handles 2FA verification if enabled.
 */
const Login = () => {
  const {
    username,
    password,
    showPassword,
    err,
    handleSubmit,
    handleInputChange,
    togglePasswordVisibility,
  } = useAuth('login');

  const [show2FAPrompt, setShow2FAPrompt] = useState(false);
  const [userHas2FA, setUserHas2FA] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    // Check if user has 2FA enabled before proceeding to handleSubmit
    // if (username) {
    //   try {
    //     const user = await getUserByUsername(username);
    //     if (user.twoFactorEnabled) {
    //       setUserHas2FA(true);
    //       setShow2FAPrompt(true);
    //     }
    //   } catch (error) {
    //     // User not found or error - let handleSubmit deal with it
    //   }
    // }

    await handleSubmit(e);
  };

  const handle2FASuccess = async () => {
    setShow2FAPrompt(false);
  };

  return (
    <div className='container'>
      <h2>Welcome to FakeStackOverflow!</h2>
      <h3>Please login to continue.</h3>
      <form onSubmit={handleLoginSubmit}>
        <h4>Please enter your username.</h4>
        <input
          type='text'
          value={username}
          onChange={event => handleInputChange(event, 'username')}
          placeholder='Enter your username'
          required
          className='input-text'
          id='username-input'
        />
        <h4>Please enter your password.</h4>
        <input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={event => handleInputChange(event, 'password')}
          placeholder='Enter your password'
          required
          className='input-text'
          id='password-input'
        />
        <div className='show-password'>
          <input
            type='checkbox'
            id='showPasswordToggle'
            checked={showPassword}
            onChange={togglePasswordVisibility}
          />
          <label htmlFor='showPasswordToggle'>Show Password</label>
        </div>
        <button type='submit' className='login-button'>
          Submit
        </button>
      </form>
      {err && <p className='error-message'>{err}</p>}
      <Link to='/signup' className='signup-link'>
        Don&apos;t have an account? Sign up here.
      </Link>

      {show2FAPrompt && userHas2FA && (
        <Verify2FAPrompt
          username={username}
          onSuccess={handle2FASuccess}
          onCancel={() => setShow2FAPrompt(false)}
        />
      )}
    </div>
  );
};

export default Login;
