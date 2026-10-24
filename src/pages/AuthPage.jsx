import { useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { ArrowLeft, Eye, EyeOff, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { useToast } from '../components/ToastContext.jsx'
import { InlineAlert } from '../components/Ui.jsx'

function homeFor(user) { return user.role === 'ADMIN' ? '/admin' : '/app' }

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register'
  const { login, register, loginWithGoogle } = useAuth()
  const { showToast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [values, setValues] = useState({ name: '', email: '', password: '' })
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const googleClientReady = Boolean(googleClientId && !googleClientId.startsWith('your-'))

  function goToWorkspace(user) {
    const requestedPath = location.state?.from
    const allowedPaths = ['/app', '/app/projects', '/app/settings', '/admin', '/admin/users', '/admin/logs', '/admin/settings']
    navigate(allowedPaths.includes(requestedPath) ? requestedPath : homeFor(user), { replace: true })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const user = isRegister ? await register(values) : await login({ email: values.email, password: values.password })
      goToWorkspace(user)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogle(credential) {
    setError('')
    setBusy(true)
    try { goToWorkspace(await loginWithGoogle(credential)) } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }

  return <main className="auth-page"><div className="auth-side-panel"><Link to="/" className="brand-lockup"><span className="orbit-mark"><i /><i /><i /></span><span>orbit<span className="brand-dot">.</span></span></Link><div className="auth-quote"><span className="quote-mark">“</span><h2>Good work needs<br />a little room to <em>grow.</em></h2><p>Welcome to the place where your team can find its flow.</p><div className="auth-quote-foot"><span className="auth-quote-avatars"><i>AL</i><i>JM</i><i>SK</i></span><span>Thoughtfully made for people who make things.</span></div></div><div className="auth-side-orbit side-orbit-a" /><div className="auth-side-orbit side-orbit-b" /><div className="auth-side-footer"><ShieldCheck size={14} />Secure, private, and built for your team</div></div>
    <div className="auth-main"><div className="auth-topline"><span>Already have a workspace?</span><Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Log in' : 'Create account'} <ArrowLeft size={13} /></Link></div><section className="auth-card"><div className="auth-card-icon"><Sparkles size={17} /></div><div className="eyebrow">{isRegister ? 'A FRESH START' : 'WELCOME BACK'}</div><h1>{isRegister ? 'Make room for good work.' : 'Good to see you again.'}</h1><p className="auth-description">{isRegister ? 'Create your Orbit account and bring your next project into focus.' : 'Sign in to pick up right where your team left off.'}</p><InlineAlert message={error} />
      <form onSubmit={handleSubmit} className="auth-form">{isRegister && <label className="field-label">Your name<input autoComplete="name" value={values.name} onChange={event => setValues({ ...values, name: event.target.value })} placeholder="Taylor Morgan" required minLength={2} maxLength={80} /></label>}<label className="field-label">Work email<input type="email" autoComplete="email" value={values.email} onChange={event => setValues({ ...values, email: event.target.value })} placeholder="you@company.com" required maxLength={180} /></label><label className="field-label">Password<span className="password-input-wrap"><input type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} value={values.password} onChange={event => setValues({ ...values, password: event.target.value })} placeholder={isRegister ? 'At least 12 characters' : 'Enter your password'} required minLength={isRegister ? 12 : 1} maxLength={72} /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></span></label><button type="submit" className="button auth-submit" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'} <LockKeyhole size={14} /></button></form>
      <div className="auth-divider"><span />or continue with<span /></div>
      {googleClientReady ? <div className="google-button-wrap"><GoogleLogin onSuccess={response => response.credential && handleGoogle(response.credential)} onError={() => setError('Google sign-in did not complete. Please try again.')} text={isRegister ? 'signup_with' : 'signin_with'} shape="rectangular" theme="outline" size="large" width="360" /></div> : <button className="google-button disabled" type="button" onClick={() => showToast('Add the Google OAuth client ID in .env to enable this option.', 'error')}><span className="google-g">G</span>Continue with Google <span className="google-setup">setup needed</span></button>}
      {isRegister ? <p className="auth-terms">By creating an account, you agree to our <a href="/">Terms</a> and <a href="/">Privacy Policy</a>.</p> : <div className="demo-login"><span className="demo-lock"><LockKeyhole size={13} /></span><div><strong>Try the demo workspace</strong><small>User: user@orbit.local · UserDemo!2026</small><small>Admin: admin@orbit.local · AdminDemo!2026</small></div><span className="demo-fill-actions"><button type="button" onClick={() => setValues({ ...values, email: 'user@orbit.local', password: 'UserDemo!2026' })}>Fill user</button><button type="button" onClick={() => setValues({ ...values, email: 'admin@orbit.local', password: 'AdminDemo!2026' })}>Fill admin</button></span></div>}</section><div className="auth-bottom"><span>© 2026 Orbit Workspace</span><Link to="/"><ArrowLeft size={12} />Back to home</Link></div></div></main>
}
