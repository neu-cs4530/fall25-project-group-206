import React, { useState } from 'react';
import use2FA from '../../../hooks/use2FA';
import './index.css';

interface Enable2FAModalProps {
  username: string;
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Modal component for enabling 2FA.
 * Displays QR code and handles token verification.
 */
const Enable2FAModal: React.FC<Enable2FAModalProps> = ({ username, onSuccess, onCancel }) => {
  const { secret, qrCode, loading, error, generateSecret, enableWith2FA, clearError, reset } =
    use2FA(username);
  const [token, setToken] = useState('');
  const [showQR, setShowQR] = useState(false);

  const handleGenerateSecret = async () => {
    await generateSecret();
    setShowQR(true);
    setToken('');
  };

  const handleVerifyAndEnable = async () => {
    if (token.length !== 6) {
      return;
    }
    const success = await enableWith2FA(token);
    if (success) {
      // Reset modal state and call parent callback
      setToken('');
      setShowQR(false);
      reset();
      onSuccess();
    }
  };

  const handleCancel = () => {
    reset();
    setToken('');
    setShowQR(false);
    onCancel();
  };

  return (
    <div className='modal-overlay'>
      <div className='modal-content enable-2fa-modal'>
        <h3>Enable Two-Factor Authentication</h3>

        {error && (
          <div className='error-message'>
            {error}
            <button onClick={clearError} style={{ marginLeft: '0.5rem' }}>
              Dismiss
            </button>
          </div>
        )}

        {!showQR ? (
          <div className='setup-step'>
            <p>
              Two-factor authentication adds an extra layer of security to your account. You'll need
              to enter a code from your authenticator app each time you log in.
            </p>
            <button
              className='button button-primary'
              onClick={handleGenerateSecret}
              disabled={loading}>
              {loading ? 'Generating...' : 'Start Setup'}
            </button>
          </div>
        ) : (
          <div className='setup-step'>
            <p>
              <strong>Step 1:</strong> Scan this QR code with your authenticator app (Google
              Authenticator, Authy, Microsoft Authenticator, etc.)
            </p>
            {qrCode && <img src={qrCode} alt='2FA QR Code' className='qr-code' />}

            <p>
              <strong>Step 2:</strong> Enter the 6-digit code from your authenticator app:
            </p>
            <input
              type='text'
              value={token}
              onChange={e => setToken(e.target.value.slice(0, 6))}
              placeholder='000000'
              maxLength={6}
              className='input-text token-input'
              disabled={loading}
            />

            <p className='info-text'>
              <strong>Save your secret key:</strong> <code>{secret}</code>
              <br />
              <small>Keep this safe in case you lose access to your authenticator app.</small>
            </p>

            <div className='modal-actions'>
              <button
                className='button button-primary'
                onClick={handleVerifyAndEnable}
                disabled={loading || token.length !== 6}>
                {loading ? 'Verifying...' : 'Verify & Enable'}
              </button>
              <button className='button button-secondary' onClick={handleCancel} disabled={loading}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Enable2FAModal;
