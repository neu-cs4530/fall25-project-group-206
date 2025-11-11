import { useState, useCallback, useEffect } from 'react';
import {
  generate2FASecret,
  enable2FA,
  disable2FA,
  verify2FAToken,
  getUserByUsername,
} from '../services/userService';

/**
 * Custom hook for managing 2FA (Two-Factor Authentication).
 * Handles setup, login verification, and management of 2FA settings.
 *
 * @param username - The username of the user managing 2FA
 * @returns Object containing 2FA state and functions for setup, verification, and disabling
 */
const use2FA = (username: string) => {
  const [secret, setSecret] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  /**
   * Fetches the current user data to check if 2FA is enabled.
   */
  const fetchTwoFAStatus = useCallback(async () => {
    if (!username) {
      setIsEnabled(false);
      return;
    }

    try {
      const user = await getUserByUsername(username);
      setIsEnabled(user.twoFactorEnabled || false);
    } catch (err) {
      setIsEnabled(false);
    }
  }, [username]);

  /**
   * Fetch 2FA status on mount or when username changes
   */
  useEffect(() => {
    fetchTwoFAStatus();
  }, [username, fetchTwoFAStatus]);

  /**
   * Generates a new 2FA secret and QR code for initial setup.
   * Called when user clicks "Enable 2FA" in settings.
   */
  const generateSecret = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await generate2FASecret(username);
      setSecret(result.secret);
      setQrCode(result.qrCode);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate 2FA secret';
      setError(errorMessage);
      setSecret('');
      setQrCode('');
    } finally {
      setLoading(false);
    }
  }, [username]);

  /**
   * Enables 2FA after user has scanned QR code and enters verification token.
   * Called from setup modal after user inputs the 6-digit code.
   *
   * @param token - The 6-digit token from the authenticator app
   * @returns true if successfully enabled, false otherwise
   */
  const enableWith2FA = useCallback(
    async (token: string): Promise<boolean> => {
      setLoading(true);
      setError('');
      try {
        if (!secret) {
          throw new Error('Secret not generated. Please generate a secret first.');
        }
        await enable2FA(username, secret, token);
        setIsEnabled(true);
        setSecret('');
        setQrCode('');
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to enable 2FA';
        setError(errorMessage);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [username, secret],
  );

  /**
   * Disables 2FA for the user.
   * Called from settings when user clicks "Disable 2FA".
   *
   * @returns true if successfully disabled, false otherwise
   */
  const disableWith2FA = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError('');
    try {
      await disable2FA(username);
      setIsEnabled(false);
      setSecret('');
      setQrCode('');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disable 2FA';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [username]);

  /**
   * Verifies a 2FA token during login.
   * Called after user enters password and is prompted for 2FA code.
   *
   * @param token - The 6-digit token from the authenticator app
   * @returns true if token is valid, false otherwise
   */
  const verifyToken = useCallback(
    async (token: string): Promise<boolean> => {
      setLoading(true);
      setError('');
      try {
        const isValid = await verify2FAToken(username, token);
        if (!isValid) {
          setError('Invalid 2FA token. Please try again.');
        }
        return isValid;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to verify token';
        setError(errorMessage);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [username],
  );

  /**
   * Clears the current error message.
   * Useful when dismissing error alerts.
   */
  const clearError = useCallback(() => {
    setError('');
  }, []);

  /**
   * Resets the hook state (clears secret, QR code, and error).
   * Useful when canceling the setup flow.
   */
  const reset = useCallback(() => {
    setSecret('');
    setQrCode('');
    setError('');
  }, []);

  return {
    // State
    secret,
    qrCode,
    isEnabled,
    loading,
    error,

    // Setup flow
    generateSecret,
    enableWith2FA,

    // Management
    disableWith2FA,

    // Login flow
    verifyToken,

    // Utilities
    clearError,
    reset,
    fetchTwoFAStatus,
  };
};

export default use2FA;
