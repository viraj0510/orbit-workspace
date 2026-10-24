import { useCallback, useEffect, useState } from 'react'
import { Activity, ChevronLeft, ChevronRight, CircleAlert, Download, Eye, Filter, Search, ShieldCheck } from 'lucide-react'
import { useToast } from '../components/ToastContext.jsx'
import { api, formatDate, timeAgo } from '../lib/api.js'
import { EmptyState, Modal, PageHeader } from '../components/Ui.jsx'

function eventTone(action) {
  if (action.includes('FAILED') || action.includes('SUSPENDED') || action.includes('DELETED')) return 'log-danger'
  if (action.includes('ADMIN') || action.includes('SYSTEM') || action.includes('SETTINGS')) return 'log-admin'
  return 'log-standard'
}

function prettyAction(action) {
  return action.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

export default function AdminLogsPage() {
  const { showToast } = useToast()
  const [logs, setLogs] = useState([])
  const [page, setPage] = useState(1)
  const [pageInfo, setPageInfo] = useState({ total: 0, pages: 1, pageSize: 20 })
  const [query, setQuery] = useState('')
  const [action, setAction] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' })
      if (query.trim()) params.set('q', query.trim())
      if (action) params.set('action', action)
      const response = await api(`/admin/logs?${params}`)
      setLogs(response.logs)
      setPageInfo(response)
    } catch (error) { showToast(error.message, 'error') } finally { setLoading(false) }
  }, [page, query, action, showToast])
  useEffect(() => { loadLogs() }, [loadLogs])

  function exportLogs() {
    const rows = [['Timestamp', 'Actor', 'Action', 'Entity', 'Entity ID', 'IP address'], ...logs.map(log => [log.createdAt, log.actorEmail || 'System', log.action, log.entity, log.entityId || '', log.ipAddress || ''])]
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    const objectUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = 'orbit-audit-trail.csv'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    showToast('Current audit page exported.')
  }

  function changeFilter(setter, value) { setter(value); setPage(1) }
  let details = {}
  try { details = selected?.metadata ? JSON.parse(selected.metadata) : {} } catch { details = { note: selected?.metadata } }

  return <>
    <PageHeader eyebrow="ADMIN · ACCOUNTABILITY" title="A clear record of what changed." description="A filterable trail of sign-ins, access changes, and important workspace events." action={<button className="button button-quiet" onClick={exportLogs}><Download size={14} />Export current page</button>} />
    <div className="logs-summary-strip"><span className="logs-summary-icon"><ShieldCheck size={16} /></span><span><strong>Audit trail is active</strong><small>Account and security events are recorded with actor, time, and request context.</small></span><span className="log-count">{pageInfo.total.toLocaleString()} EVENTS</span></div>
    <section className="panel-card logs-panel"><div className="logs-toolbar"><div><span className="eyebrow">WORKSPACE EVENTS</span><h2>System logs</h2></div><div className="projects-toolbar-actions"><label className="table-search"><Search size={15} /><input value={query} onChange={event => changeFilter(setQuery, event.target.value)} placeholder="Search actor or event" aria-label="Search logs" /></label><label className="filter-select"><Filter size={14} /><select value={action} onChange={event => changeFilter(setAction, event.target.value)} aria-label="Filter log events"><option value="">All events</option><option value="LOGIN">Sign-ins</option><option value="FAILED">Failed attempts</option><option value="USER_">User changes</option><option value="PROJECT_">Project changes</option><option value="SETTINGS">Configuration</option></select></label></div></div>
      <div className="logs-table-wrap"><table className="logs-table"><thead><tr><th>EVENT</th><th>ACTOR</th><th>RESOURCE</th><th>WHEN</th><th>IP ADDRESS</th><th /></tr></thead><tbody>{logs.map(log => <tr key={log.id}><td><span className={`log-event-icon ${eventTone(log.action)}`}>{log.action.includes('FAILED') ? <CircleAlert size={14} /> : log.action.includes('ADMIN') ? <ShieldCheck size={14} /> : <Activity size={14} />}</span><span className="log-event-name"><strong>{prettyAction(log.action)}</strong><small>{log.id.slice(-8)}</small></span></td><td><span className="log-actor">{log.actorEmail || 'System'}</span></td><td><span className="log-resource"><b>{log.entity}</b>{log.entityId ? <small>{log.entityId.slice(0, 12)}</small> : <small>—</small>}</span></td><td><span className="log-time">{timeAgo(log.createdAt)}<small>{formatDate(log.createdAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></span></td><td><code className="ip-address">{log.ipAddress || '—'}</code></td><td><button className="icon-button" onClick={() => setSelected(log)} aria-label="View event details"><Eye size={15} /></button></td></tr>)}</tbody></table>{loading && <div className="table-state">Loading audit events…</div>}{!loading && !logs.length && <EmptyState icon={Activity} title="No events match" description="Try a different search or event filter." />}</div>
      <div className="pagination-row"><span>Showing <strong>{logs.length ? (page - 1) * pageInfo.pageSize + 1 : 0}–{Math.min(page * pageInfo.pageSize, pageInfo.total)}</strong> of <strong>{pageInfo.total}</strong> events</span><div><button className="pagination-button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1 || loading}><ChevronLeft size={15} />Previous</button><span className="page-count">{page} <i>/</i> {pageInfo.pages}</span><button className="pagination-button" onClick={() => setPage(value => Math.min(pageInfo.pages, value + 1))} disabled={page >= pageInfo.pages || loading}>Next<ChevronRight size={15} /></button></div></div>
    </section>
    <div className="admin-footer-note"><span><ShieldCheck size={13} />Audit records are available to workspace admins</span><span>Newest events first</span></div>
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Event details" description={selected ? prettyAction(selected.action) : ''} size="sm"><div className="log-detail-list"><div><span>Actor</span><strong>{selected?.actorEmail || 'System'}</strong></div><div><span>Timestamp</span><strong>{selected ? new Date(selected.createdAt).toLocaleString() : '—'}</strong></div><div><span>Resource</span><strong>{selected?.entity || '—'}{selected?.entityId ? ` · ${selected.entityId}` : ''}</strong></div><div><span>IP address</span><strong>{selected?.ipAddress || 'Not available'}</strong></div><div><span>Event ID</span><strong>{selected?.id}</strong></div><div><span>Additional details</span><pre>{JSON.stringify(details, null, 2)}</pre></div></div><div className="modal-actions"><button className="button button-quiet" onClick={() => setSelected(null)}>Close</button></div></Modal>
  </>
}
