import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, CircleAlert, Pencil, Plus, Search, ShieldCheck, Trash2, UserRound, UsersRound } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { useToast } from '../components/ToastContext.jsx'
import { api, formatDate, timeAgo } from '../lib/api.js'
import { EmptyState, InlineAlert, Modal, PageHeader, StatusPill } from '../components/Ui.jsx'

const blankUser = { name: '', email: '', password: '', role: 'USER' }

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const { showToast } = useToast()
  const [users, setUsers] = useState([])
  const [page, setPage] = useState(1)
  const [pageInfo, setPageInfo] = useState({ total: 0, pages: 1, pageSize: 10 })
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [formUser, setFormUser] = useState(null)
  const [form, setForm] = useState(blankUser)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [pendingId, setPendingId] = useState('')
  const [deleting, setDeleting] = useState(false)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '10' })
      if (query.trim()) params.set('q', query.trim())
      if (role) params.set('role', role)
      if (status) params.set('status', status)
      const response = await api(`/admin/users?${params}`)
      setUsers(response.users)
      setPageInfo(response)
    } catch (error) { showToast(error.message, 'error') } finally { setLoading(false) }
  }, [page, query, role, status, showToast])

  useEffect(() => { loadUsers() }, [loadUsers])

  function openCreate() {
    setFormUser(null)
    setForm(blankUser)
    setFormError('')
    setFormOpen(true)
  }

  function openEdit(account) {
    setFormUser(account)
    setForm({ name: account.name, email: account.email, password: '', role: account.role })
    setFormError('')
    setFormOpen(true)
  }

  async function saveUser(event) {
    event.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      if (formUser) await api(`/admin/users/${formUser.id}`, { method: 'PATCH', body: { name: form.name, email: form.email } })
      else await api('/admin/users', { method: 'POST', body: form })
      setFormOpen(false)
      showToast(formUser ? 'Account details updated.' : 'Workspace account created.')
      await loadUsers()
    } catch (error) { setFormError(error.message) } finally { setSaving(false) }
  }

  async function updateAccount(account, change) {
    setPendingId(account.id)
    try {
      await api(`/admin/users/${account.id}`, { method: 'PATCH', body: change })
      showToast(change.role ? `${account.name} is now ${change.role === 'ADMIN' ? 'an admin' : 'a user'}.` : change.status === 'SUSPENDED' ? 'Account suspended and sessions revoked.' : 'Account reactivated.')
      await loadUsers()
    } catch (error) { showToast(error.message, 'error') } finally { setPendingId('') }
  }

  async function removeAccount() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api(`/admin/users/${deleteTarget.id}`, { method: 'DELETE', body: {} })
      setDeleteTarget(null)
      showToast('Account deleted and active sessions revoked.')
      await loadUsers()
    } catch (error) { showToast(error.message, 'error') } finally { setDeleting(false) }
  }

  function filter(setter, value) { setter(value); setPage(1) }
  const activeCount = users.filter(account => account.status === 'ACTIVE').length

  return <>
    <PageHeader eyebrow="ADMIN · PEOPLE" title="The people in your orbit." description="Create accounts, adjust access, and keep your workspace in good hands." action={<button className="button" onClick={openCreate}><Plus size={15} />Add a member</button>} />
    <section className="user-console-summary"><span className="console-summary-icon"><UsersRound size={17} /></span><div><strong>{pageInfo.total} workspace members</strong><small>{activeCount} active on this page · role changes and removals are written to the audit trail.</small></div><span className="console-summary-badge"><ShieldCheck size={13} />RBAC ACTIVE</span></section>
    <section className="panel-card user-console-card"><div className="user-console-toolbar"><div><span className="eyebrow">ACCOUNT DIRECTORY</span><h2>Manage workspace access</h2></div><div className="projects-toolbar-actions"><label className="table-search"><Search size={15} /><input value={query} onChange={event => filter(setQuery, event.target.value)} placeholder="Search people" aria-label="Search members" /></label><label className="filter-select"><select value={role} onChange={event => filter(setRole, event.target.value)} aria-label="Filter by role"><option value="">All roles</option><option value="USER">Users</option><option value="ADMIN">Admins</option></select></label><label className="filter-select"><select value={status} onChange={event => filter(setStatus, event.target.value)} aria-label="Filter by status"><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select></label></div></div>
      <div className="user-table-wrap"><table className="user-table"><thead><tr><th>MEMBER</th><th>ROLE</th><th>STATUS</th><th>PROJECTS</th><th>LAST ACTIVE</th><th>JOINED</th><th>ACTIONS</th></tr></thead><tbody>{users.map(account => <tr key={account.id}><td><div className="member-cell"><span className={`member-avatar ${account.role === 'ADMIN' ? 'admin-avatar' : ''}`}>{account.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}</span><span><strong>{account.name}{account.id === currentUser?.id && <em>YOU</em>}</strong><small>{account.email}</small></span></div></td><td><button className={`role-toggle ${account.role === 'ADMIN' ? 'role-admin' : ''}`} disabled={pendingId === account.id || account.id === currentUser?.id} onClick={() => updateAccount(account, { role: account.role === 'ADMIN' ? 'USER' : 'ADMIN' })} title={account.id === currentUser?.id ? 'You cannot change your own role' : 'Click to change role'}><i />{account.role === 'ADMIN' ? 'Admin' : 'User'}<span>{account.id === currentUser?.id ? '·' : '↔'}</span></button></td><td><button className={`status-toggle ${account.status === 'ACTIVE' ? 'status-active' : 'status-suspended'}`} disabled={pendingId === account.id || account.id === currentUser?.id} onClick={() => updateAccount(account, { status: account.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' })} title={account.id === currentUser?.id ? 'You cannot suspend your own account' : 'Click to toggle account status'}><i />{account.status === 'ACTIVE' ? 'Active' : 'Suspended'}</button></td><td><span className="project-count-cell"><FolderKanban size={13} />{account.projectCount}</span></td><td><span className="last-active-cell">{timeAgo(account.lastSessionAt)}</span></td><td><span className="joined-cell">{formatDate(account.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}</span></td><td><div className="member-actions"><button className="icon-button" onClick={() => openEdit(account)} aria-label={`Edit ${account.name}`}><Pencil size={14} /></button><button className="icon-button delete-icon" onClick={() => setDeleteTarget(account)} disabled={account.id === currentUser?.id} aria-label={`Delete ${account.name}`}><Trash2 size={14} /></button></div></td></tr>)}</tbody></table>{loading && <div className="table-state">Loading workspace accounts…</div>}{!loading && !users.length && <EmptyState icon={UserRound} title="No members match" description="Try a different name, email, role, or status." />}</div>
      <div className="pagination-row"><span>Showing <strong>{users.length ? (page - 1) * pageInfo.pageSize + 1 : 0}–{Math.min(page * pageInfo.pageSize, pageInfo.total)}</strong> of <strong>{pageInfo.total}</strong> accounts</span><div><button className="pagination-button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1 || loading}><ChevronLeft size={15} />Previous</button><span className="page-count">{page} <i>/</i> {pageInfo.pages}</span><button className="pagination-button" onClick={() => setPage(value => Math.min(pageInfo.pages, value + 1))} disabled={page >= pageInfo.pages || loading}>Next<ChevronRight size={15} /></button></div></div>
    </section>
    <div className="admin-footer-note"><span><ShieldCheck size={13} />Administrator access is audited</span><span>{pageInfo.total} accounts in workspace</span></div>
    <Modal open={formOpen} onClose={() => setFormOpen(false)} title={formUser ? 'Edit account' : 'Add a workspace member'} description={formUser ? 'Update member details and email address.' : 'Set up an account with the right access from day one.'}>
      <form className="modal-form" onSubmit={saveUser}><InlineAlert message={formError} /><label className="field-label">Full name<input autoFocus value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required minLength={2} maxLength={80} placeholder="Taylor Morgan" /></label><label className="field-label">Email address<input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} required maxLength={180} placeholder="taylor@company.com" /></label>{!formUser && <><label className="field-label">Temporary password<input type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} required minLength={12} maxLength={72} placeholder="At least 12 characters" /></label><label className="field-label">Workspace role<select value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}><option value="USER">User — personal workspace</option><option value="ADMIN">Admin — system access</option></select></label><div className="permission-note"><ShieldCheck size={14} />Admin accounts can view system metrics and manage workspace members.</div></>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setFormOpen(false)}>Cancel</button><button className="button" type="submit" disabled={saving}>{saving ? 'Saving…' : formUser ? 'Save account' : 'Create account'}<ChevronRight size={14} /></button></div></form>
    </Modal>
    <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Delete this account?" description={deleteTarget ? `${deleteTarget.name} will lose access immediately. Their projects and sessions will be removed.` : ''} size="sm"><div className="delete-modal-icon"><CircleAlert size={18} /></div><div className="modal-actions"><button className="button button-quiet" onClick={() => setDeleteTarget(null)}>Keep account</button><button className="button button-danger" onClick={removeAccount} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete account'}<Trash2 size={14} /></button></div></Modal>
  </>
}
