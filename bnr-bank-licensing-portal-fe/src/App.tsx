import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './features/auth/auth.store';
import { ErrorBoundary } from './shared/ui/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell';
import LoginPage from './features/auth/LoginPage';
import ApplicantDashboard from './features/applications/pages/ApplicantDashboard';
import ReviewerQueue from './features/applications/pages/ReviewerQueue';
import ApproverQueue from './features/applications/pages/ApproverQueue';
import NewApplicationPage from './features/applications/pages/NewApplicationPage';
import ApplicationDetailPage from './features/applications/pages/ApplicationDetailPage';
import AdminUsersPage from './features/admin/pages/AdminUsersPage';
import AdminSettingsPage from './features/admin/pages/AdminSettingsPage';
import { PageSpinner } from './shared/ui/Spinner';

/** Render the right dashboard per role */
function ApplicationsIndex() {
  const { user } = useAuthStore();
  if (!user) return null;
  if (user.role === 'REVIEWER') return <ReviewerQueue />;
  if (user.role === 'APPROVER') return <ApproverQueue />;
  return <ApplicantDashboard />;
}

function RootRedirect() {
  const { user, loading } = useAuthStore();
  if (loading) return <PageSpinner />;
  return <Navigate to={user ? '/applications' : '/login'} replace />;
}

export default function App() {
  const hydrate = useAuthStore(s => s.hydrate);

  useEffect(() => { hydrate(); }, [hydrate]);

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
          <Route index element={<RootRedirect />} />

          <Route path="/applications" element={
            <ProtectedRoute roles={['APPLICANT','REVIEWER','APPROVER','ADMIN']}>
              <ApplicationsIndex />
            </ProtectedRoute>
          } />

          <Route path="/applications/new" element={
            <ProtectedRoute roles={['APPLICANT']}>
              <NewApplicationPage />
            </ProtectedRoute>
          } />

          <Route path="/applications/:id" element={
            <ProtectedRoute roles={['APPLICANT','REVIEWER','APPROVER','ADMIN']}>
              <ApplicationDetailPage />
            </ProtectedRoute>
          } />

          <Route path="/admin/users" element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminUsersPage />
            </ProtectedRoute>
          } />

          <Route path="/admin/settings" element={
            <ProtectedRoute roles={['ADMIN']}>
              <AdminSettingsPage />
            </ProtectedRoute>
          } />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}







