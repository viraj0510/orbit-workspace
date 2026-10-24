import { useEffect, useState } from 'react'
import { Activity, ArrowRight, ArrowUpRight, BellRing, CircleAlert, Clock3, FolderKanban, ShieldCheck, UsersRound, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, timeAgo } from '../lib/api.js'
import { useToast } from '../components/ToastContext.jsx'
import { GrowthChart, ProjectDonut } from '../components/Charts.jsx'
import { PageHeader, StatusPill } from '../components/Ui.jsx'

function AdminMetric({ icon: Icon, label, value, note, tone = 'green' }) {
  return <article className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={16} /></div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><small className="metric-note">{note}</small></article>
}

export default function AdminDashboard() {
  const { showToast } = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { api('/admin/metrics').then(setData).catch(error => showToast(error.message, 'error')).finally(() => setLoading(false)) }, [showToast])
  const metrics = data?.metrics || {}
  const alerts = data?.alerts || []

  return <>
    <PageHeader eyebrow="ADMINISTRATION · SYSTEM OVERVIEW" title="A healthy orbit." description="The people, projects, and signals shaping your workspace." action={<Link className="button button-quiet" to="/admin/logs"><Activity size={14} />View audit trail<ArrowRight size={14} /></Link>} />
    <section className="metric-grid admin-metric-grid"><AdminMetric icon={UsersRound} label="Total users" value={loading ? '—' : metrics.totalUsers ?? 0} note={`${metrics.activeUsers ?? 0} active accounts`} /><AdminMetric icon={Activity} label="Active sessions" value={loading ? '—' : metrics.activeSessions ?? 0} note="Live authenticated sessions" tone="blue" /><AdminMetric icon={ShieldCheck} label="System health" value={loading ? '—' : `${metrics.health ?? 0}%`} note="All core systems operational" tone="violet" /><AdminMetric icon={FolderKanban} label="Projects in orbit" value={loading ? '—' : metrics.projects ?? 0} note={`${metrics.suspendedUsers ?? 0} suspended accounts`} tone="amber" /></section>
    <section className="admin-charts-grid"><article className="panel-card admin-growth-card"><div className="panel-heading"><div><span className="eyebrow">PLATFORM GROWTH</span><h2>New accounts</h2><p>A look at new workspace members this week.</p></div><span className="growth-badge"><ArrowUpRight size={13} />Weekly view</span></div><GrowthChart data={data?.growth || []} /></article><article className="panel-card admin-project-card"><div className="panel-heading"><div><span className="eyebrow">WORKSPACE SNAPSHOT</span><h2>Project health</h2><p>Current project distribution by status.</p></div></div><ProjectDonut data={data?.projectStatus || []} /><Link to="/admin/users" className="panel-link admin-project-link">Manage workspace members <ArrowRight size={14} /></Link></article></section>
    <section className="admin-lower-grid"><article className="panel-card admin-alerts-card"><div className="panel-heading"><div><span className="eyebrow">RECENT SIGNALS</span><h2>System activity</h2></div><Link to="/admin/logs" className="panel-link">Full audit trail <ArrowRight size={13} /></Link></div>{alerts.length ? <div className="admin-alert-list">{alerts.map(log => <div key={log.id} className="admin-alert-row"><span className={`admin-alert-icon ${log.action === 'LOGIN_FAILED' ? 'alert-amber' : log.action === 'USER_SUSPENDED' ? 'alert-red' : 'alert-blue'}`}>{log.action === 'LOGIN_FAILED' ? <CircleAlert size={15} /> : log.action === 'USER_SUSPENDED' ? <ShieldCheck size={15} /> : <UsersRound size={15} />}</span><div><strong>{log.action.replaceAll('_', ' ').toLowerCase()}</strong><small>{log.actorEmail || 'System'}{log.entityId ? ` · ${log.entity}` : ''}</small></div><time>{timeAgo(log.createdAt)}</time></div>)}</div> : <div className="admin-empty-activity"><span><Zap size={17} /></span><strong>It’s calm in here.</strong><small>Security events and account changes will show up here.</small></div>}</article><article className="panel-card system-health-card"><div className="panel-heading"><div><span className="eyebrow">PLATFORM STATUS</span><h2>All systems operational</h2></div><StatusPill tone="green">Healthy</StatusPill></div><div className="health-main"><span className="health-pulse"><i /><i /></span><div><strong>99.98%</strong><small>system availability</small></div><span className="health-uptime"><ArrowUpRight size={13} />within target</span></div><div className="health-services"><div><span>Authentication API</span><StatusPill tone="green">Operational</StatusPill></div><div><span>Project services</span><StatusPill tone="green">Operational</StatusPill></div><div><span>Session store</span><StatusPill tone="green">Operational</StatusPill></div></div><div className="health-note"><Clock3 size={13} />No active incidents reported</div></article></section>
    <div className="admin-footer-note"><span><i />Admin workspace access is logged</span><span><BellRing size={13} />{metrics.activeSessions ?? 0} active sessions</span></div>
  </>
}
