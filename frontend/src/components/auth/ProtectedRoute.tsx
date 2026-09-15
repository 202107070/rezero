import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../contexts/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, authReady } = useAuth();

  if (!authReady) return null;

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return children;
}
