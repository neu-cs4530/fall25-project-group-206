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
    // After 2FA verification succeeds, get the user and complete login
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
      <h2>Welcome to FakeStackOverflow!</h2>
      <h3>Please login to continue.</h3>

      {!requires2FA ? (
        <>
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
        </>
      ) : (
        <Verify2FAPrompt
          username={username}
          onSuccess={handle2FASuccess}
          onCancel={() => {
            // Cancel 2FA - reload to reset state
            window.location.reload();
          }}
        />
      )}
    </div>
  );
};

export default Login;
