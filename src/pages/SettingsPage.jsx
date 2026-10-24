import { useEffect, useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { BellRing, Check, ChevronRight, KeyRound, Mail, ShieldCheck, UserRound, UserRoundCheck } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { useToast } from '../components/ToastContext.jsx'
import { api } from '../lib/api.js'
import { InlineAlert, PageHeader, StatusPill } from '../components/Ui.jsx'

export default function SettingsPage() {
  const { user, updateUser, refreshAuth } = useAuth()
  const { showToast } = useToast()
  const [name, setName] = useState(user?.name || '')
  const [preferences, setPreferences] = useState({ emailUpdates: true, productNews: false, securityAlerts: true, ...(user?.preferences || {}) })
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [profileError, setProfileError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const googleClientReady = Boolean(googleClientId && !googleClientId.startsWith('your-'))

  useEffect(() => {
    setName(user?.name || '')
    setPreferences({ emailUpdates: true, productNews: false, securityAlerts: true, ...(user?.preferences || {}) })
  }, [user?.id, user?.name])

  async function saveProfile(event) {
    event.preventDefault()
    setProfileError('')
    setSavingProfile(true)
    try {
      const response = await api('/auth/profile', { method: 'PATCH', body: { name } })
      updateUser(response.user)
      showToast('Your profile has been updated.')
    } catch (error) { setProfileError(error.message) } finally { setSavingProfile(false) }
  }

  async function savePreferences() {
    setSavingPreferences(true)
    try {
      const response = await api('/auth/profile', { method: 'PATCH', body: { preferences } })
      updateUser(response.user)
      showToast('Notification preferences saved.')
    } catch (error) { showToast(error.message, 'error') } finally { setSavingPreferences(false) }
  }

  async function changePassword(event) {
    event.preventDefault()
    setPasswordError('')
    setSavingPassword(true)
    try {
      await api('/auth/password', { method: 'POST', body: { ...(user?.hasPassword ? { currentPassword } : {}), newPassword } })
      await refreshAuth()
      setCurrentPassword('')
      setNewPassword('')
      showToast('Password updated. Other sessions were signed out.')
    } catch (error) { setPasswordError(error.message) } finally { setSavingPassword(false) }
  }

  async function connectGoogle(credential) {
    setGoogleBusy(true)
    try {
      const response = await api('/auth/google', { method: 'POST', body: { credential } })
      updateUser(response.user)
      showToast('Your Google account is connected.')
    } catch (error) { showToast(error.message, 'error') } finally { setGoogleBusy(false) }
  }

  const notificationOptions = [
    { key: 'emailUpdates', title: 'Project updates', text: 'A quiet summary of changes to your projects.' },
    { key: 'productNews', title: 'Product notes', text: 'Occasional news about Orbit improvements.' },
    { key: 'securityAlerts', title: 'Security alerts', text: 'Important sign-in and account safety notices.' },
  ]

  return <>
    <PageHeader eyebrow="YOUR ACCOUNT · SETTINGS" title="A space of your own." description="Update your profile, security, and the way Orbit keeps in touch." />
    <div className="settings-layout"><nav className="settings-nav"><a className="settings-nav-active" href="#profile"><UserRound size={15} />Profile</a><a href="#security"><ShieldCheck size={15} />Security</a><a href="#notifications"><BellRing size={15} />Notifications</a></nav><div className="settings-sections">
      <section className="panel-card settings-card" id="profile"><div className="settings-card-heading"><span className="settings-card-icon"><UserRound size={16} /></span><div><h2>Personal details</h2><p>The basics your team sees around the workspace.</p></div></div><form className="settings-form" onSubmit={saveProfile}><InlineAlert message={profileError} /><label className="field-label">Full name<input value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={80} /></label><label className="field-label">Email address<span className="input-with-icon"><Mail size={14} /><input value={user?.email || ''} readOnly /></span><small className="field-helper">Email changes need administrator review.</small></label><div className="settings-form-footer"><span>Profile created {new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(user?.createdAt || Date.now()))}</span><button className="button" type="submit" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save changes'}<Check size={14} /></button></div></form></section>
      <section className="panel-card settings-card" id="security"><div className="settings-card-heading"><span className="settings-card-icon security-icon"><KeyRound size={16} /></span><div><h2>Security & sign-in</h2><p>Your account stays in your hands.</p></div></div><div className="connected-account-row"><span className="connected-account-icon">G</span><span className="connected-account-copy"><strong>Google account</strong><small>{user?.googleConnected ? 'Google sign-in is connected to this account.' : 'Use your verified work email to connect Google sign-in.'}</small></span>{user?.googleConnected ? <StatusPill tone="green">Connected</StatusPill> : googleClientReady ? <GoogleLogin onSuccess={response => response.credential && connectGoogle(response.credential)} onError={() => showToast('Google sign-in did not complete.', 'error')} text="continue_with" shape="pill" theme="outline" size="medium" /> : <button className="button button-quiet" onClick={() => showToast('Add the Google OAuth client ID in .env to enable account linking.', 'error')}>Setup needed<ChevronRight size={13} /></button>}</div><form className="settings-form password-form" onSubmit={changePassword}><div className="password-section-title"><strong>{user?.hasPassword ? 'Change password' : 'Add a password'}</strong><small>{user?.hasPassword ? 'Choose a new password of at least 12 characters.' : 'You signed in with Google. Add a password as another sign-in option.'}</small></div>{user?.hasPassword && <label className="field-label">Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required /></label>}<InlineAlert message={passwordError} /><label className="field-label">{user?.hasPassword ? 'New password' : 'Password'}<input type="password" autoComplete="new-password" minLength={12} maxLength={72} value={newPassword} onChange={event => setNewPassword(event.target.value)} required placeholder="At least 12 characters" /></label><div className="settings-form-footer"><span><ShieldCheck size={13} />Other sessions sign out after a password change</span><button className="button button-secondary" type="submit" disabled={savingPassword}>{savingPassword ? 'Updating…' : 'Update password'}<ChevronRight size={14} /></button></div></form></section>
      <section className="panel-card settings-card" id="notifications"><div className="settings-card-heading"><span className="settings-card-icon bell-icon"><BellRing size={16} /></span><div><h2>Notification preferences</h2><p>Choose what’s worth a note from us.</p></div></div><div className="preference-list">{notificationOptions.map(option => <label className="preference-row" key={option.key}><span><strong>{option.title}</strong><small>{option.text}</small></span><input className="switch-input" type="checkbox" checked={Boolean(preferences[option.key])} onChange={event => setPreferences(current => ({ ...current, [option.key]: event.target.checked }))} /></label>)}</div><div className="settings-form-footer"><span><Mail size={13} />You can change these at any time</span><button className="button" onClick={savePreferences} disabled={savingPreferences}>{savingPreferences ? 'Saving…' : 'Save preferences'}<Check size={14} /></button></div></section>
    </div></div>
  </>
}
