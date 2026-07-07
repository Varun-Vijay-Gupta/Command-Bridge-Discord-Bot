import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/servers', label: 'Servers', icon: '🖥️' },
  { to: '/commands', label: 'Commands', icon: '⚡' },
  { to: '/logs', label: 'Logs', icon: '📋' },
  { to: '/failures', label: 'Failures', icon: '⚠️' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { admin, logout } = useAuth();

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span>⚡</span> CommandBridge
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `nav-link${isActive ? ' active' : ''}`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '0 1.5rem', marginTop: 'auto' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            {admin?.email}
          </p>
          <button className="btn btn-secondary btn-sm" onClick={logout} style={{ width: '100%' }}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
