import React, { useState } from 'react';
import use2FA from '../../../hooks/use2FA';
import './index.css';

interface Verify2FAPromptProps {
  username: string;
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Prompt component for verifying 2FA token during login.
 * Displayed after successful password verification if 2FA is enabled.
 */
const Verify2FAPrompt: React.FC<Verify2FAPromptProps> = ({ username, onSuccess, onCancel }) => {
  const { loading, error, verifyToken } = use2FA(username);
  const [token, setToken] = useState('');

  const handleVerify = async () => {
    if (token.length !== 6) {
      return;
    }
    const isValid = await verifyToken(token);
    if (isValid) {
      onSuccess();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && token.length === 6) {
      handleVerify();
    }
  };

  return (
    <div className='modal-overlay'>
      <div className='modal-content verify-2fa-prompt'>
        <h3>Two-Factor Authentication Required</h3>

        {error && <p className='error-message'>{error}</p>}

        <p>Enter the 6-digit code from your authenticator app:</p>

        <input
          type='text'
          value={token}
          onChange={e => setToken(e.target.value.slice(0, 6))}
          onKeyPress={handleKeyPress}
          placeholder='000000'
          maxLength={6}
          className='input-text token-input'
          disabled={loading}
          autoFocus
        />

        <div className='modal-actions'>
          <button
            className='button button-primary'
            onClick={handleVerify}
            disabled={loading || token.length !== 6}>
            {loading ? 'Verifying...' : 'Verify'}
          </button>
          <button className='button button-secondary' onClick={onCancel} disabled={loading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default Verify2FAPrompt;
