import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity, ArrowUpRight, Bell, ChevronDown, ChevronLeft, CircleHelp,
  Command, FolderKanban, Gauge, LayoutDashboard, LogOut, Menu, Search,
  Settings2, ShieldCheck, Sparkles, UsersRound, X,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { useToast } from './ToastContext.jsx'
import { api } from '../lib/api.js'

const userNavigation = [
  { label: 'Overview', to: '/app', icon: LayoutDashboard, end: true },
  { label: 'My projects', to: '/app/projects', icon: FolderKanban },
  { label: 'Settings', to: '/app/settings', icon: Settings2 },
]
const adminNavigation = [
  { label: 'Overview', to: '/admin', icon: LayoutDashboard, end: true },
  { label: 'User management', to: '/admin/users', icon: UsersRound },
  { label: 'Audit trail', to: '/admin/logs', icon: Activity },
  { label: 'Configuration', to: '/admin/settings', icon: Settings2 },
]
const titleMap = {
  '/app': 'Overview', '/app/projects': 'My projects', '/app/settings': 'Settings',
  '/admin': 'Overview', '/admin/users': 'User management', '/admin/logs': 'Audit trail', '/admin/settings': 'Configuration',
}

export default function AppShell({ admin = false }) {
  const { user, logout } = useAuth()
  const { showToast } = useToast()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('Orbit Workspace')
  const navigation = admin ? adminNavigation : userNavigation
  const base = admin ? '/admin' : '/app'

  useEffect(() => { api('/config').then(config => setWorkspaceName(config.platformName)).catch(() => {}) }, [])

  async function handleLogout() {
    try {
      await logout()
      window.location.assign('/login')
    } catch {
      showToast('Could not sign out. Please retry.', 'error')
    }
  }

  return <div className="workspace-shell">
    <aside className={`workspace-sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <Link to={base} className="brand-lockup"><span className="orbit-mark"><i /><i /><i /></span><span>orbit<span className="brand-dot">.</span></span><span className="brand-beta">WORKSPACE</span></Link>
      <button className="workspace-picker" onClick={() => showToast(`You are in ${workspaceName}.`)}><span className="workspace-logo">{workspaceName.slice(0, 1).toUpperCase()}</span><span className="workspace-picker-copy"><strong>{workspaceName}</strong><small>{admin ? 'Administration' : 'Personal workspace'}</small></span><ChevronDown size={14} /></button>
      <div className="nav-label">WORKSPACE</div>
      <nav className="workspace-nav" aria-label="Workspace navigation">{navigation.map(({ label, to, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMobileOpen(false)} className={({ isActive }) => `workspace-nav-link ${isActive ? 'active' : ''}`}><Icon size={17} /><span>{label}</span>{label === 'My projects' && <span className="nav-link-arrow"><ArrowUpRight size={13} /></span>}</NavLink>)}</nav>
      {admin && <div className="nav-section-note"><ShieldCheck size={14} /><span>Admin privileges enabled</span></div>}
      <div className="sidebar-lower"><div className="upgrade-card"><span className="upgrade-glow"><Sparkles size={14} /></span><strong>Make space for more.</strong><p>Keep your team and projects moving with Orbit.</p><button onClick={() => showToast('You are already on the Orbit workspace plan.')}>Explore workspace <ArrowUpRight size={13} /></button></div><button className="help-link" onClick={() => showToast('Help center is ready for your team.')}><CircleHelp size={16} />Help center<ArrowUpRight size={12} /></button><div className="account-row"><span className="user-avatar">{user?.name?.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'U'}</span><span className="account-copy"><strong>{user?.name}</strong><small>{user?.email}</small></span><button className="account-more" onClick={() => setProfileOpen(value => !value)} aria-label="Account menu"><ChevronDown size={15} /></button>{profileOpen && <div className="account-menu"><Link to={`${base}/settings`} onClick={() => setProfileOpen(false)}><Settings2 size={14} />Account settings</Link><button onClick={handleLogout}><LogOut size={14} />Sign out</button></div>}</div></div>
    </aside>
    {mobileOpen && <button className="sidebar-overlay" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
    <div className="workspace-main">
      <header className="workspace-topbar"><button className="mobile-nav-toggle icon-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button><div className="topbar-context"><span className="context-mark"><Command size={14} /></span><span>{workspaceName}</span><ChevronLeft size={13} className="context-divider" /><strong>{titleMap[location.pathname] || 'Workspace'}</strong></div><div className="topbar-actions"><label className="global-search"><Search size={15} /><input aria-label="Search" placeholder="Search workspace" onKeyDown={event => { if (event.key === 'Enter' && !admin) window.location.assign(`/app/projects?q=${encodeURIComponent(event.currentTarget.value)}`) }} /><kbd>⌘ K</kbd></label><span className="topbar-separator" /><button className="icon-button topbar-bell" aria-label="Notifications" onClick={() => showToast('You are all caught up.')}><Bell size={17} /><i /></button><span className="topbar-avatar">{user?.name?.slice(0, 1).toUpperCase() || 'U'}</span></div></header>
      <AnimatePresence mode="wait"><motion.main className="workspace-content" key={location.pathname} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: .17 }}><Outlet /></motion.main></AnimatePresence>
      <footer className="workspace-footer"><span>© 2026 Orbit Workspace</span><span><i className="footer-live" />All systems operational</span><span>Privacy <i>·</i> Terms</span></footer>
    </div>
  </div>
}
