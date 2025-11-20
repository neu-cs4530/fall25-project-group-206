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

  const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    await handleSubmit(e);
  };

  const handle2FASuccess = async () => {
    try {
      const { loginUser } = await import('../../../services/userService');
      const user = await loginUser({ username, password });
      completeLogin(user);
    } catch (error) {
      //
    }
  };

  return (
    <div className='container'>
      <div className='auth-card'>
        <h2>Welcome Back!</h2>
        <h3>Please login to continue</h3>

        {!requires2FA ? (
          <>
            <form onSubmit={handleLoginSubmit}>
              <div className='form-group'>
                <h4>Username or Email</h4>
                <input
                  type='text'
                  value={username}
                  onChange={event => handleInputChange(event, 'username')}
                  placeholder='Enter your username or email'
                  required
                  className='input-text'
                  id='username-input'
                />
              </div>

              <div className='form-group'>
                <h4>Password</h4>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={event => handleInputChange(event, 'password')}
                  placeholder='Enter your password'
                  required
                  className='input-text'
                  id='password-input'
                />
              </div>

              <div className='show-password'>
                <input
                  type='checkbox'
                  id='showPasswordToggle'
                  checked={showPassword}
                  onChange={togglePasswordVisibility}
                />
                <label htmlFor='showPasswordToggle'>Show Password</label>
              </div>

              {err && <p className='error-message'>{err}</p>}

              <button type='submit' className='login-button'>
                Submit
              </button>
            </form>

            <div className='divider'>
              <span>OR</span>
            </div>

            <a href='/api/auth/google' className='google-login-btn'>
              <svg className='google-icon' viewBox='0 0 24 24'>
                <path
                  fill='#4285F4'
                  d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
                />
                <path
                  fill='#34A853'
                  d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
                />
                <path
                  fill='#FBBC05'
                  d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
                />
                <path
                  fill='#EA4335'
                  d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
                />
              </svg>
              Continue with Google
            </a>
            <div className='divider'></div>
            <Link to='/signup' className='signup-link'>
              Don't have an account? Sign up here
            </Link>
          </>
        ) : (
          <Verify2FAPrompt
            username={username}
            onSuccess={handle2FASuccess}
            onCancel={() => {
              window.location.reload();
            }}
          />
        )}
      </div>
    </div>
  );
};

export default Login;
