import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Ellipsis, Filter, FolderKanban, Plus, Search, Trash2 } from 'lucide-react'
import { api, formatDate } from '../lib/api.js'
import { useToast } from '../components/ToastContext.jsx'
import { EmptyState, InlineAlert, Modal, PageHeader, StatusPill } from '../components/Ui.jsx'

const statusLabels = { PLANNING: 'Planning', IN_PROGRESS: 'In progress', REVIEW: 'In review', DONE: 'Complete' }
const statusTone = { PLANNING: 'neutral', IN_PROGRESS: 'blue', REVIEW: 'amber', DONE: 'green' }
const priorities = ['LOW', 'MEDIUM', 'HIGH']
const statuses = ['PLANNING', 'IN_PROGRESS', 'REVIEW', 'DONE']

const freshProject = () => ({ name: '', description: '', status: 'PLANNING', priority: 'MEDIUM', dueAt: '' })

export default function ProjectsPage() {
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [projects, setProjects] = useState([])
  const [page, setPage] = useState(1)
  const [pageInfo, setPageInfo] = useState({ total: 0, pages: 1, pageSize: 8 })
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(freshProject())
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const shouldLoad = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '8' })
      if (query.trim()) params.set('q', query.trim())
      if (status) params.set('status', status)
      if (priority) params.set('priority', priority)
      const response = await api(`/projects?${params.toString()}`)
      setProjects(response.projects)
      setPageInfo(response)
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [page, query, status, priority, showToast])

  useEffect(() => { shouldLoad() }, [shouldLoad])
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openCreate()
      searchParams.delete('new')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const completeCount = useMemo(() => projects.filter(project => project.status === 'DONE').length, [projects])

  function openCreate() {
    setEditing(null)
    setForm(freshProject())
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(project) {
    setEditing(project)
    setForm({ name: project.name, description: project.description, status: project.status, priority: project.priority, dueAt: project.dueAt ? new Date(project.dueAt).toISOString().slice(0, 10) : '' })
    setFormError('')
    setModalOpen(true)
  }

  async function saveProject(event) {
    event.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      const body = { ...form, dueAt: form.dueAt || null }
      await api(editing ? `/projects/${editing.id}` : '/projects', { method: editing ? 'PATCH' : 'POST', body })
      setModalOpen(false)
      showToast(editing ? 'Project updated.' : 'Project created.')
      await shouldLoad()
    } catch (error) {
      setFormError(error.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteProject() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api(`/projects/${deleteTarget.id}`, { method: 'DELETE', body: {} })
      setDeleteTarget(null)
      showToast('Project removed from your workspace.')
      await shouldLoad()
    } catch (error) {
      showToast(error.message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  function changeFilter(setter, value) { setter(value); setPage(1) }

  return <>
    <PageHeader eyebrow="YOUR WORK · PROJECTS" title="My projects" description="Keep your ideas, priorities, and progress in one thoughtful place." action={<button className="button" onClick={openCreate}><Plus size={15} />New project</button>} />
    <div className="projects-summary"><div><span className="summary-dot" /><strong>{pageInfo.total}</strong><span>projects in your orbit</span></div><span className="summary-divider" /><div><strong>{completeCount}</strong><span>completed on this page</span></div><span className="summary-right"><span className="summary-small-mark"><FolderKanban size={15} /></span>Made for meaningful progress</span></div>
    <section className="panel-card projects-panel"><div className="projects-toolbar"><div><span className="eyebrow">PROJECT SPACE</span><h2>Everything you’re moving forward</h2></div><div className="projects-toolbar-actions"><label className="table-search"><Search size={15} /><input value={query} onChange={event => changeFilter(setQuery, event.target.value)} placeholder="Find a project" aria-label="Search projects" /><kbd>⌘ F</kbd></label><label className="filter-select"><Filter size={14} /><select value={status} onChange={event => changeFilter(setStatus, event.target.value)} aria-label="Filter by status"><option value="">All statuses</option>{statuses.map(item => <option key={item} value={item}>{statusLabels[item]}</option>)}</select></label><label className="filter-select"><select value={priority} onChange={event => changeFilter(setPriority, event.target.value)} aria-label="Filter by priority"><option value="">All priorities</option>{priorities.map(item => <option key={item} value={item}>{item[0] + item.slice(1).toLowerCase()} priority</option>)}</select></label></div></div>
      <div className="project-table-wrap"><table className="project-table"><thead><tr><th>PROJECT</th><th>STATUS</th><th>PRIORITY</th><th>DUE DATE</th><th>OWNER</th><th aria-label="Actions" /></tr></thead><tbody>{projects.map(project => <tr key={project.id}><td><div className="project-name-cell"><span className={`project-mark mark-${project.status.toLowerCase()}`}><FolderKanban size={15} /></span><span><strong>{project.name}</strong><small>{project.description || 'No description added yet.'}</small></span></div></td><td><StatusPill tone={statusTone[project.status]}>{statusLabels[project.status] || project.status}</StatusPill></td><td><span className={`priority-label priority-${project.priority.toLowerCase()}`}><i />{project.priority[0] + project.priority.slice(1).toLowerCase()}</span></td><td><span className="table-date"><CalendarDays size={13} />{formatDate(project.dueAt, { month: 'short', day: 'numeric', year: 'numeric' })}</span></td><td><span className="owner-cell"><i>{project.owner?.name?.split(' ').map(name => name[0]).slice(0, 2).join('').toUpperCase() || 'U'}</i>{project.owner?.name || 'You'}</span></td><td><div className="table-actions"><button className="icon-button" onClick={() => openEdit(project)} aria-label={`Edit ${project.name}`}><Ellipsis size={17} /></button><button className="icon-button delete-icon" onClick={() => setDeleteTarget(project)} aria-label={`Delete ${project.name}`}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table>
      {loading && <div className="table-state">Gathering your projects…</div>}
      {!loading && !projects.length && <EmptyState icon={CircleAlert} title={query || status || priority ? 'No projects found' : 'Start with an idea'} description={query || status || priority ? 'Try adjusting your search or filters.' : 'Create a project to give your next good idea a place to grow.'} action={!query && !status && !priority ? <button className="button" onClick={openCreate}><Plus size={14} />Create your first project</button> : null} />}
      </div>
      <div className="pagination-row"><span>Showing <strong>{projects.length ? (page - 1) * pageInfo.pageSize + 1 : 0}–{Math.min(page * pageInfo.pageSize, pageInfo.total)}</strong> of <strong>{pageInfo.total}</strong> projects</span><div><button className="pagination-button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1 || loading}><ChevronLeft size={15} />Previous</button><span className="page-count">{page} <i>/</i> {pageInfo.pages}</span><button className="pagination-button" onClick={() => setPage(value => Math.min(pageInfo.pages, value + 1))} disabled={page >= pageInfo.pages || loading}>Next<ChevronRight size={15} /></button></div></div>
    </section>
    <div className="projects-footnote"><span><i />Changes are saved to your workspace</span><span>{pageInfo.total} {pageInfo.total === 1 ? 'project' : 'projects'} · Secure, private, yours</span></div>
    <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit project' : 'Create a project'} description="Give the work a name, then shape it as you go.">
      <form className="modal-form" onSubmit={saveProject}><InlineAlert message={formError} /><label className="field-label">Project name<input autoFocus required minLength={2} maxLength={100} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="e.g. Customer onboarding refresh" /></label><label className="field-label">A little context <span className="optional-label">OPTIONAL</span><textarea rows="3" maxLength={1200} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="What would you like to make progress on?" /></label><div className="form-two-col"><label className="field-label">Status<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}>{statuses.map(item => <option value={item} key={item}>{statusLabels[item]}</option>)}</select></label><label className="field-label">Priority<select value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value })}>{priorities.map(item => <option value={item} key={item}>{item[0] + item.slice(1).toLowerCase()}</option>)}</select></label></div><label className="field-label">Due date <span className="optional-label">OPTIONAL</span><input type="date" value={form.dueAt} onChange={event => setForm({ ...form, dueAt: event.target.value })} /></label><div className="modal-actions"><button className="button button-quiet" type="button" onClick={() => setModalOpen(false)}>Cancel</button><button className="button" type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create project'}<ChevronRight size={14} /></button></div></form>
    </Modal>
    <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Remove this project?" description={deleteTarget ? `“${deleteTarget.name}” will be permanently removed from your workspace.` : ''} size="sm"><div className="delete-modal-icon"><Trash2 size={18} /></div><div className="modal-actions"><button className="button button-quiet" onClick={() => setDeleteTarget(null)}>Keep project</button><button className="button button-danger" onClick={deleteProject} disabled={deleting}>{deleting ? 'Removing…' : 'Remove project'}<Trash2 size={14} /></button></div></Modal>
  </>
}
