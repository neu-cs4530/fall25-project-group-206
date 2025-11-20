import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import useLoginContext from '../../../hooks/useLoginContext';

import { SafeDatabaseUser } from '../../../types/types';

const OAuthSuccess = () => {
  const { setUser } = useLoginContext();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');

    if (!token) {
      navigate('/');
      return;
    }

    try {
      const decoded = jwtDecode<SafeDatabaseUser>(token);
      setUser(decoded);
      navigate('/home');
    } catch (err) {
      navigate('/');
    }
  }, [location.search, navigate, setUser]);

  return <p>Logging in...</p>;
};

export default OAuthSuccess;
