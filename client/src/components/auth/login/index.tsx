import './index.css';
import { Link } from 'react-router-dom';
import useAuth from '../../../hooks/useAuth';
import Verify2FAPrompt from '../../twoFactorAuth/Verify2FAPrompt';

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
    requires2FA,
    handleSubmit,
    handleInputChange,
    togglePasswordVisibility,
    completeLogin,
  } = useAuth('login');

  console.log('[Login] Rendered. requires2FA =', requires2FA, '| username =', username);

  const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    console.log('[Login] handleLoginSubmit() fired');
    try {
      await handleSubmit(e);
      console.log('[Login] handleSubmit() completed without throwing');
    } catch (error) {
      console.error('[Login] handleSubmit() threw error:', error);
    }
  };

  const handle2FASuccess = async () => {
    console.log('[Login] handle2FASuccess() called');
    try {
      const { loginUser } = await import('../../../services/userService');
      console.log('[Login] Dynamic import of userService successful');
      console.log('[Login] Attempting loginUser() with:', { username, password });
      const user = await loginUser({ username, password });
      console.log('[Login] loginUser() success ->', user);
      completeLogin(user);
      console.log('[Login] completeLogin() called');
    } catch (error) {
      console.error('[Login] ❌ Error in handle2FASuccess():', error);
    }
  };

  return (
    <div className='container'>
      <h2>Welcome to FakeStackOverflow!</h2>
      <h3>Please login to continue.</h3>

      {!requires2FA ? (
        <>
          <form onSubmit={handleLoginSubmit}>
            <h4>Please enter your username.</h4>
            <input
              type='text'
              value={username}
              onChange={event => {
                console.log('[Login] Username input changed:', event.target.value);
                handleInputChange(event, 'username');
              }}
              placeholder='Enter your username'
              required
              className='input-text'
              id='username-input'
            />
            <h4>Please enter your password.</h4>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={event => {
                console.log('[Login] Password input changed');
                handleInputChange(event, 'password');
              }}
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
                onChange={() => {
                  console.log('[Login] Toggled password visibility ->', !showPassword);
                  togglePasswordVisibility();
                }}
              />
              <label htmlFor='showPasswordToggle'>Show Password</label>
            </div>
            <button type='submit' className='login-button'>
              Submit
            </button>
          </form>

          {err && <p className='error-message'>[Login] ⚠️ Error: {err}</p>}

          <Link to='/signup' className='signup-link'>
            Don&apos;t have an account? Sign up here.
          </Link>
        </>
      ) : (
        <Verify2FAPrompt
          username={username}
          onSuccess={handle2FASuccess}
          onCancel={() => {
            console.warn('[Login] 2FA cancelled — reloading page');
            window.location.reload();
          }}
        />
      )}
    </div>
  );
};

export default Login;
