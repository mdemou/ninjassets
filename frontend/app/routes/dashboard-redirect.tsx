import { useEffect } from 'react';
import { useNavigate } from 'react-router';

export default function DashboardRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate('/', { replace: true });
  }, [navigate]);

  return null;
}
