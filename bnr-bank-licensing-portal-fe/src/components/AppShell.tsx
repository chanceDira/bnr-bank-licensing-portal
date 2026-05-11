import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuthStore } from '../features/auth/auth.store';
import { RoleBadge } from '../shared/ui/Badge';

const TITLES: Record<string, string> = {
  '/applications':     'Applications',
  '/applications/new': 'New Application',
  '/admin/users':      'User Management',
  '/admin/settings':   'Settings',
};

function pageTitle(pathname: string) {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith('/applications/')) return 'Application Detail';
  return 'BNR Licensing Portal';
}

export default function AppShell() {
  const { user }     = useAuthStore();
  const { pathname } = useLocation();

  return (
    <div className="app-shell">
      <Sidebar />

      <header className="app-header">
        <span style={{ fontWeight: 600, fontSize: '.95rem' }}>{pageTitle(pathname)}</span>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem' }}>
            <span className="text-sm text-muted">{user.email}</span>
            <RoleBadge role={user.role} />
          </div>
        )}
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
