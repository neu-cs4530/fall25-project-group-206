import './index.css';
import { Link } from 'react-router-dom';
import useAuth from '../../../hooks/useAuth';

/**
 * Renders a signup form with username, password, and password confirmation inputs,
 * password visibility toggle, error handling, and a link to the login page.
 */
const Signup = () => {
  const {
    username,
    password,
    email,
    passwordConfirmation,
    showPassword,
    err,
    handleSubmit,
    handleInputChange,
    togglePasswordVisibility,
  } = useAuth('signup');

  return (
    <div className='container'>
      <div className='auth-card'>
        <h2>Create Account</h2>
        <h3>Join CodeStack today</h3>

        <form onSubmit={handleSubmit}>
          <div className='form-group'>
            <h4>Username</h4>
            <input
              type='text'
              value={username}
              onChange={event => handleInputChange(event, 'username')}
              placeholder='Choose a username'
              required
              className='input-text'
              id='username-input'
            />
          </div>

          <div className='form-group'>
            <h4>Email</h4>
            <input
              type='email'
              value={email}
              onChange={event => handleInputChange(event, 'email')}
              placeholder='Enter your email'
              required
              className='input-text'
              id='email-input'
            />
          </div>

          <div className='form-group'>
            <h4>Password</h4>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={event => handleInputChange(event, 'password')}
              placeholder='Create a password'
              required
              className='input-text'
              id='password-input'
            />
          </div>

          <div className='form-group'>
            <h4>Confirm Password</h4>
            <input
              type={showPassword ? 'text' : 'password'}
              value={passwordConfirmation}
              onChange={event => handleInputChange(event, 'confirmPassword')}
              placeholder='Confirm your password'
              required
              className='input-text'
              id='confirm-password-input'
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

          <button type='submit' className='signup-button'>
            Create Account
          </button>
        </form>

        <div className='divider'></div>

        <Link to='/' className='login-link'>
          Already have an account? Sign in here
        </Link>
      </div>
    </div>
  );
};

export default Signup;
