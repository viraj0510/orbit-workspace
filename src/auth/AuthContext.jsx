import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshAuth = useCallback(async () => {
    try {
      const response = await api('/auth/me')
      setUser(response.user)
      return response.user
    } catch {
      setUser(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refreshAuth() }, [refreshAuth])

  const login = useCallback(async credentials => {
    const response = await api('/auth/login', { method: 'POST', body: credentials })
    setUser(response.user)
    return response.user
  }, [])

  const register = useCallback(async details => {
    const response = await api('/auth/register', { method: 'POST', body: details })
    setUser(response.user)
    return response.user
  }, [])

  const loginWithGoogle = useCallback(async credential => {
    const response = await api('/auth/google', { method: 'POST', body: { credential } })
    setUser(response.user)
    return response.user
  }, [])

  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST', body: {} }) } finally { setUser(null) }
  }, [])

  const updateUser = useCallback(nextUser => setUser(nextUser), [])
  const value = useMemo(() => ({ user, loading, login, register, loginWithGoogle, logout, refreshAuth, updateUser }), [user, loading, login, register, loginWithGoogle, logout, refreshAuth, updateUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider.')
  return context
}
