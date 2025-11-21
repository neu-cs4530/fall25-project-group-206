import { useNavigate, useLocation } from 'react-router-dom';
import { ChangeEvent, useState, useEffect } from 'react';
import useLoginContext from './useLoginContext';
import { createUser, loginUser } from '../services/userService';
import { SafeDatabaseUser } from '@fake-stack-overflow/shared';

/**
 * Custom hook to manage authentication logic, including handling input changes,
 * form submission, password visibility toggling, and error validation for both
 * login and signup processes.
 *
 * @param authType - Specifies the authentication type ('login' or 'signup').
 * @returns {Object} An object containing:
 *   - username: The current value of the username input.
 *   - password: The current value of the password input.
 *   - email: The current value of the email input.
 *   - passwordConfirmation: The current value of the password confirmation input (for signup).
 *   - showPassword: Boolean indicating whether the password is visible.
 *   - err: The current error message, if any.
 *   - requires2FA: Boolean indicating if 2FA verification is required.
 *   - handleInputChange: Function to handle changes in input fields.
 *   - handleSubmit: Function to handle form submission.
 *   - togglePasswordVisibility: Function to toggle password visibility.
 */
const useAuth = (authType: 'login' | 'signup') => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [passwordConfirmation, setPasswordConfirmation] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string>('');
  const [requires2FA, setRequires2FA] = useState(false);
  const { setUser } = useLoginContext();
  const navigate = useNavigate();

  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlError = params.get('error');

    if (urlError) {
      setErr(urlError);
    }
  }, [location.search]);

  /**
   * Toggles the visibility of the password input field.
   */
  const togglePasswordVisibility = () => {
    setShowPassword(prevState => !prevState);
  };

  /**
   * Handles changes in input fields and updates the corresponding state.
   *
   * @param e - The input change event.
   * @param field - The field being updated ('username', 'password', or 'confirmPassword').
   */
  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement>,
    field: 'username' | 'email' | 'password' | 'confirmPassword',
  ) => {
    const fieldText = e.target.value.trim();

    if (field === 'username') {
      setUsername(fieldText);
    } else if (field === 'email') {
      setEmail(fieldText);
    } else if (field === 'password') {
      setPassword(fieldText);
    } else if (field === 'confirmPassword') {
      setPasswordConfirmation(fieldText);
    }
  };

  /**
   * Validates the input fields for the form.
   * Ensures required fields are filled and passwords match (for signup).
   *
   * @returns {boolean} True if inputs are valid, false otherwise.
   */
  const validateInputs = (): boolean => {
    if (username === '' || password === '') {
      setErr('Please enter a username and password');
      return false;
    }

    if (authType === 'signup') {
      if (email === '') {
        setErr('Please enter an email');
        return false;
      }
      if (password !== passwordConfirmation) {
        setErr('Passwords do not match');
        return false;
      }
    }

    return true;
  };

  /**
   * Completes the login process by setting user context and navigating to home.
   * Called after password verification (and 2FA verification if required).
   *
   * @param user - The authenticated user object.
   */
  const completeLogin = (user: SafeDatabaseUser) => {
    setUser(user);
    setRequires2FA(false);
    setUsername('');
    setPassword('');
    setPasswordConfirmation('');
    setErr('');
    navigate('/home');
  };

  /**
   * Handles the submission of the form.
   * Validates input, performs login/signup, and checks for 2FA requirement.
   * For login: if 2FA is enabled, prompts for 2FA verification instead of completing login.
   * For signup: completes login immediately.
   *
   * @param event - The form submission event.
   */
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateInputs()) {
      return;
    }

    let user;
    try {
      if (authType === 'signup') {
        user = await createUser({ username, password, email });
        completeLogin(user);
      } else if (authType === 'login') {
        user = await loginUser({ username, password });

        // Check if user has 2FA enabled
        if (user.twoFactorEnabled) {
          // Don't complete login yet - wait for 2FA verification
          setRequires2FA(true);
          setErr('');
          return;
        }

        // No 2FA required - complete login immediately
        completeLogin(user);
      } else {
        throw new Error('Invalid auth type');
      }
    } catch (error) {
      setErr((error as Error).message);
      setRequires2FA(false);
    }
  };

  return {
    username,
    password,
    email,
    passwordConfirmation,
    showPassword,
    err,
    requires2FA,
    handleInputChange,
    handleSubmit,
    togglePasswordVisibility,
    completeLogin,
  };
};

export default useAuth;
