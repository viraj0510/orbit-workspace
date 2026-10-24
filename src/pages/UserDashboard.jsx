import { useEffect, useState } from 'react'
import { Activity, ArrowRight, ArrowUpRight, CheckCircle2, Clock3, FolderKanban, Plus, Sparkles, Target } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, formatDate, timeAgo } from '../lib/api.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { useToast } from '../components/ToastContext.jsx'
import { ActivityChart } from '../components/Charts.jsx'
import { PageHeader, StatusPill } from '../components/Ui.jsx'

function Metric({ icon: Icon, label, value, note, tone = 'green' }) {
  return <article className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={16} /></div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><small className="metric-note">{note}</small></article>
}

export default function UserDashboard() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/dashboard').then(setDashboard).catch(error => showToast(error.message, 'error')).finally(() => setLoading(false))
  }, [showToast])

  const metrics = dashboard?.metrics || { total: 0, inProgress: 0, done: 0, updatedThisWeek: 0 }
  const activity = dashboard?.activity || []
  const projects = dashboard?.projects || []
  const todayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase()

  return <>
    <PageHeader eyebrow={`YOUR WORKSPACE · ${todayLabel}`} title={`Good morning, ${user?.name?.split(' ')[0] || 'there'}.`} description="Your work is taking shape. Here’s a little snapshot of what’s moving." action={<Link to="/app/projects?new=1" className="button"><Plus size={15} />New project</Link>} />
    <section className="metric-grid user-metric-grid">
      <Metric icon={FolderKanban} label="My projects" value={loading ? '—' : metrics.total} note="Projects in your workspace" />
      <Metric icon={Activity} label="In progress" value={loading ? '—' : metrics.inProgress} note="Work moving forward" tone="blue" />
      <Metric icon={CheckCircle2} label="Completed" value={loading ? '—' : metrics.done} note={`${metrics.updatedThisWeek} updated this week`} tone="violet" />
      <Metric icon={Target} label="Weekly focus" value="86%" note="A steady week so far" tone="amber" />
    </section>
    <section className="dashboard-grid">
      <article className="panel-card activity-panel"><div className="panel-heading"><div><span className="eyebrow">YOUR MOMENTUM</span><h2>Workspace activity</h2><p>Small steps add up. Here’s your last seven days.</p></div><button className="range-chip" onClick={() => showToast('Showing your last 7 days.')}>Last 7 days <span>⌄</span></button></div><ActivityChart data={activity} /><div className="chart-footer"><span><i className="legend-green" />Activity across your workspace</span><span><ArrowUpRight size={13} />You're finding your rhythm</span></div></article>
      <article className="panel-card focus-panel"><div className="panel-heading"><div><span className="eyebrow">YOUR WEEKLY FOCUS</span><h2>A good rhythm</h2></div><span className="focus-ring"><Sparkles size={16} /></span></div><p className="focus-copy">You’ve updated <strong>{metrics.updatedThisWeek} projects</strong> this week. Keep your momentum going, one thoughtful step at a time.</p><div className="focus-progress-label"><span>Weekly progress</span><strong>86%</strong></div><div className="focus-progress"><i style={{ width: '86%' }} /></div><div className="focus-foot"><span><span className="mini-avatar">{user?.name?.slice(0, 1)}</span>Good things are in motion</span><span>4 days left</span></div></article>
    </section>
    <section className="lower-grid"><article className="panel-card recent-panel"><div className="panel-heading"><div><span className="eyebrow">IN YOUR ORBIT</span><h2>Recent projects</h2></div><Link className="panel-link" to="/app/projects">View all <ArrowRight size={14} /></Link></div>{loading ? <div className="loading-row">Gathering your projects…</div> : projects.length ? <div className="recent-project-list">{projects.slice(0, 4).map(project => <Link to="/app/projects" key={project.id} className="recent-project-row"><span className={`project-mark mark-${project.status.toLowerCase()}`}><FolderKanban size={15} /></span><span className="recent-project-copy"><strong>{project.name}</strong><small>{project.owner?.name || user?.name} · updated {timeAgo(project.updatedAt)}</small></span><StatusPill tone={project.status.toLowerCase()}>{project.status.replace('_', ' ')}</StatusPill><span className="recent-date">{formatDate(project.dueAt)}</span><ArrowRight size={14} className="recent-arrow" /></Link>)}</div> : <div className="empty-inline"><span>No projects yet</span><Link to="/app/projects?new=1">Create one <ArrowRight size={13} /></Link></div>}</article>
      <article className="panel-card quick-panel"><div className="panel-heading"><div><span className="eyebrow">SHORTCUTS</span><h2>Make a little progress</h2></div></div><Link className="quick-action" to="/app/projects?new=1"><span className="quick-action-icon green"><Plus size={16} /></span><span><strong>Start a project</strong><small>Give an idea a place to begin</small></span><ArrowRight size={14} /></Link><Link className="quick-action" to="/app/settings"><span className="quick-action-icon blue"><Clock3 size={16} /></span><span><strong>Set your preferences</strong><small>Make Orbit feel like yours</small></span><ArrowRight size={14} /></Link><button className="daily-note" onClick={() => showToast('Your daily note is saved for this session.')}><span className="daily-note-mark">✳</span><span><strong>A thought for today</strong><small>Progress is built one good decision at a time.</small></span></button></article></section>
    <div className="dashboard-footnote"><span><i />All your work is up to date</span><span>Last synced {dashboard?.events?.length ? timeAgo(dashboard.events[0].createdAt) : 'just now'}</span></div>
  </>
}
