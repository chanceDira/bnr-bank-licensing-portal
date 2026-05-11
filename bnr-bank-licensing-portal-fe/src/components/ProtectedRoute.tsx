import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../features/auth/auth.store';
import type { UserRole } from '../shared/types';
import { PageSpinner } from '../shared/ui/Spinner';

interface Props {
  children: React.ReactNode;
  roles?: UserRole[];
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { user, loading } = useAuthStore();

  if (loading) return <PageSpinner />;
  if (!user)   return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/applications" replace />;

  return <>{children}</>;
}
