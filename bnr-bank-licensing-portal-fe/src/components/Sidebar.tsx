import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../features/auth/auth.store';

const Icon = ({ d, d2 }: { d: string; d2?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />{d2 && <path d={d2} />}
  </svg>
);

function NavItem({ to, end, label, icon }: { to: string; end?: boolean; label: string; icon: React.ReactNode }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
      {icon} {label}
    </NavLink>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  if (!user) return null;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand bg-white">
        <div className=' mt-2'>
        <img src="/bnr__logo.jpeg" style={{ borderRadius: '50%' }} className=' rounded-full' alt="BNR Logo" width={50} height={50} />
        </div>
        <div className=' bg-white'>
          <div className="sidebar-brand-name">Licensing Portal</div>
          <div className="sidebar-brand-sub">National Bank of Rwanda</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {user.role === 'APPLICANT' && (
          <>
            <span className="sidebar-section-label">My Applications</span>
            <NavItem to="/applications" end label="Dashboard" icon={<Icon d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" d2="M9 22V12h6v10" />} />
            <NavItem to="/applications/new" label="New Application" icon={<Icon d="M12 5v14M5 12h14" />} />
          </>
        )}
        {user.role === 'REVIEWER' && (
          <>
            <span className="sidebar-section-label">Review Work</span>
            <NavItem to="/applications" end label="Review Queue" icon={<Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" d2="M9 12l2 2 4-4" />} />
          </>
        )}
        {user.role === 'APPROVER' && (
          <>
            <span className="sidebar-section-label">Decisions</span>
            <NavItem to="/applications" end label="Approval Queue" icon={<Icon d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />} />
          </>
        )}
        {user.role === 'ADMIN' && (
          <>
            <span className="sidebar-section-label">Administration</span>
            <NavItem to="/applications" end label="All Applications" icon={<Icon d="M3 7h18M3 12h18M3 17h18" />} />
            <NavItem to="/admin/users" label="Manage Users" icon={<Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" d2="M9 7a4 4 0 100 8 4 4 0 000-8z" />} />
            <NavItem to="/admin/settings" label="Settings" icon={<Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" d2="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />} />
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <button
          className="btn btn-ghost btn-sm"
          style={{ color: 'rgba(255, 255, 255, 0.84)', marginTop: '.2rem' }}
          onClick={logout}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}
