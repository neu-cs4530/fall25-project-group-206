import { useNavigate } from 'react-router-dom';
import { ChangeEvent, useState } from 'react';
import useLoginContext from './useLoginContext';
import { createUser, loginUser } from '../services/userService';
import { SafeDatabaseUser } from '@fake-stack-overflow/shared';
import { io } from 'socket.io-client';

const serverURL = import.meta.env.VITE_SERVER_URL || 'http://localhost:8000';

const useAuth = (authType: 'login' | 'signup') => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [passwordConfirmation, setPasswordConfirmation] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string>('');
  const [requires2FA, setRequires2FA] = useState(false);
  const { setUser, setSocket } = useLoginContext();
  const navigate = useNavigate();

  console.log(`[useAuth] Initialized for ${authType}.`);

  /** Toggles the visibility of the password input field. */
  const togglePasswordVisibility = () => {
    setShowPassword(prevState => !prevState);
    console.log('[useAuth] Toggled password visibility ->', !showPassword);
  };

  /** Handles input field updates. */
  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement>,
    field: 'username' | 'password' | 'confirmPassword',
  ) => {
    const fieldText = e.target.value.trim();
    console.log(`[useAuth] handleInputChange(${field}) -> "${fieldText}"`);
    if (field === 'username') setUsername(fieldText);
    else if (field === 'password') setPassword(fieldText);
    else if (field === 'confirmPassword') setPasswordConfirmation(fieldText);
  };

  /** Validates inputs. */
  const validateInputs = (): boolean => {
    console.log('[useAuth] Validating inputs:', { username, password, passwordConfirmation });
    if (username === '' || password === '') {
      setErr('Please enter a username and password');
      console.warn('[useAuth] ❌ Validation failed: empty username or password');
      return false;
    }
    if (authType === 'signup' && password !== passwordConfirmation) {
      setErr('Passwords do not match');
      console.warn('[useAuth] ❌ Validation failed: passwords do not match');
      return false;
    }
    console.log('[useAuth] ✅ Inputs valid');
    return true;
  };

  /** Completes login by setting user context and navigating home. */
  const completeLogin = (user: SafeDatabaseUser) => {
    console.log('[useAuth] completeLogin() called with user:', user);
    setUser(user);

    console.log('[useAuth] Requesting socket connection...');
    const newSocket = io(serverURL, {
      path: '/socket.io',
      withCredentials: true,
    });

    newSocket.on('connect', () => {
      console.log('[useAuth] Socket connected:', newSocket.id);
      newSocket.emit('register-user', user.username);
    });

    setSocket(newSocket);
    console.log('[useAuth] Socket initialized, navigating to /home');
    navigate('/home');
  };

  /** Handles form submission. */
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log(`[useAuth] handleSubmit() triggered for ${authType}`);

    if (!validateInputs()) {
      console.log('[useAuth] Validation failed — aborting submit');
      return;
    }

    let user;
    try {
      if (authType === 'signup') {
        console.log('[useAuth] Creating user:', { username, password });
        user = await createUser({ username, password });
        console.log('[useAuth] ✅ User created:', user);
        completeLogin(user);
      } else if (authType === 'login') {
        console.log('[useAuth] Attempting login for:', username);
        user = await loginUser({ username, password });
        console.log('[useAuth] ✅ loginUser() success:', user);

        if (user.twoFactorEnabled) {
          console.log('[useAuth] 🔐 2FA required — switching to 2FA prompt');
          setRequires2FA(true);
          setErr('');
          return;
        }

        console.log('[useAuth] 🚀 No 2FA required — completing login');
        completeLogin(user);
      } else {
        throw new Error('Invalid auth type');
      }
    } catch (error) {
      const msg = (error as Error).message;
      console.error('[useAuth] ❌ handleSubmit() caught error:', msg);
      setErr(msg);
      setRequires2FA(false);
    }
  };

  return {
    username,
    password,
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
