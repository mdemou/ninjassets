import { useEffect } from 'react';
import { useNavigate } from 'react-router';

export default function ProfileRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate('/settings', { replace: true });
  }, [navigate]);

  return null;
}
