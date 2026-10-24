import React from 'react'
import ReactDOM from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { ToastProvider } from './components/ToastContext.jsx'
import './styles.css'

const app = <AuthProvider><ToastProvider><App /></ToastProvider></AuthProvider>
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
const googleConfigured = clientId && !clientId.startsWith('your-')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {googleConfigured ? <GoogleOAuthProvider clientId={clientId}>{app}</GoogleOAuthProvider> : app}
  </React.StrictMode>,
)
