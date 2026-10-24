import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Globe2, LockKeyhole, Save, ShieldCheck, UserPlus } from 'lucide-react'
import { api } from '../lib/api.js'
import { useToast } from '../components/ToastContext.jsx'
import { InlineAlert, PageHeader, StatusPill } from '../components/Ui.jsx'

const defaultSettings = { platformName: 'Orbit Workspace', allowRegistrations: true, maintenanceMode: false, requireGoogleForAdmins: false }

export default function AdminSettingsPage() {
  const { showToast } = useToast()
  const [settings, setSettings] = useState(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/admin/settings').then(response => setSettings({ ...defaultSettings, ...response.settings })).catch(requestError => setError(requestError.message)).finally(() => setLoading(false))
  }, [])

  async function saveSettings(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await api('/admin/settings', { method: 'PATCH', body: settings })
      setSettings({ ...defaultSettings, ...response.settings })
      showToast('Workspace configuration saved.')
    } catch (requestError) { setError(requestError.message) } finally { setSaving(false) }
  }

  function toggle(key) { setSettings(current => ({ ...current, [key]: !current[key] })) }

  return <>
    <PageHeader eyebrow="ADMIN · WORKSPACE CONTROLS" title="Set the tone for Orbit." description="Shape how people join, sign in, and move through your workspace." action={<StatusPill tone="green"><ShieldCheck size={12} />Admin access</StatusPill>} />
    <form className="admin-settings-layout" onSubmit={saveSettings}><div className="admin-settings-main"><InlineAlert message={error} />
      <section className="panel-card settings-card"><div className="settings-card-heading"><span className="settings-card-icon"><Globe2 size={16} /></span><div><h2>Workspace identity</h2><p>The name members see when they arrive.</p></div></div><label className="field-label settings-wide-field">Workspace name<input value={settings.platformName} onChange={event => setSettings(current => ({ ...current, platformName: event.target.value }))} minLength={2} maxLength={60} required disabled={loading} /><small className="field-helper">This name appears in the workspace navigation and account emails.</small></label></section>
      <section className="panel-card settings-card"><div className="settings-card-heading"><span className="settings-card-icon security-icon"><LockKeyhole size={16} /></span><div><h2>Access & authentication</h2><p>Set clear boundaries for who can join and how admins sign in.</p></div></div><div className="admin-toggle-list"><label className="admin-toggle-row"><span className="admin-toggle-icon"><UserPlus size={15} /></span><span className="admin-toggle-copy"><strong>Allow account registration</strong><small>People can create a standard user account from the public sign-up page.</small></span><input className="switch-input" type="checkbox" checked={settings.allowRegistrations} onChange={() => toggle('allowRegistrations')} disabled={loading} /></label><label className="admin-toggle-row"><span className="admin-toggle-icon"><ShieldCheck size={15} /></span><span className="admin-toggle-copy"><strong>Require Google sign-in for admins</strong><small>Administrator accounts must use a verified Google identity.</small></span><input className="switch-input" type="checkbox" checked={settings.requireGoogleForAdmins} onChange={() => toggle('requireGoogleForAdmins')} disabled={loading} /></label></div>{settings.requireGoogleForAdmins && <div className="settings-callout"><AlertTriangle size={14} /><span>Make sure each admin account has connected Google sign-in before enabling this requirement.</span></div>}</section>
      <section className="panel-card settings-card"><div className="settings-card-heading"><span className="settings-card-icon maintenance-icon"><AlertTriangle size={16} /></span><div><h2>Workspace availability</h2><p>Pause member access during maintenance.</p></div></div><label className="admin-toggle-row maintenance-row"><span className="admin-toggle-icon"><LockKeyhole size={15} /></span><span className="admin-toggle-copy"><strong>Maintenance mode</strong><small>Active sessions for standard users are blocked until maintenance ends. Admin access remains available.</small></span><input className="switch-input" type="checkbox" checked={settings.maintenanceMode} onChange={() => toggle('maintenanceMode')} disabled={loading} /></label>{settings.maintenanceMode && <div className="maintenance-warning"><AlertTriangle size={14} />Members will see a maintenance message when they access the workspace.</div>}</section>
      <div className="admin-settings-submit"><span><ShieldCheck size={14} />Changes are recorded in the audit trail.</span><button className="button" type="submit" disabled={saving || loading}>{saving ? 'Saving…' : 'Save configuration'}<Save size={14} /></button></div>
    </div><aside className="admin-settings-aside"><div className="settings-aside-card"><span className="aside-shield"><ShieldCheck size={17} /></span><span className="eyebrow">CURRENT CONFIGURATION</span><h3>{settings.platformName}</h3><div className="aside-setting-line"><span>New registrations</span><StatusPill tone={settings.allowRegistrations ? 'green' : 'neutral'}>{settings.allowRegistrations ? 'Open' : 'Closed'}</StatusPill></div><div className="aside-setting-line"><span>Admin sign-in</span><StatusPill tone={settings.requireGoogleForAdmins ? 'blue' : 'neutral'}>{settings.requireGoogleForAdmins ? 'Google required' : 'Password or Google'}</StatusPill></div><div className="aside-setting-line"><span>Member access</span><StatusPill tone={settings.maintenanceMode ? 'amber' : 'green'}>{settings.maintenanceMode ? 'Maintenance' : 'Available'}</StatusPill></div><div className="aside-card-footer"><Check size={13} />Least-privilege access is on</div></div><div className="settings-aside-note"><LockKeyhole size={15} /><div><strong>Changes are protected</strong><p>Only active administrators can update workspace configuration.</p></div></div></aside></form>
  </>
}
