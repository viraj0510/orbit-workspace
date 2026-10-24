import jwt from 'jsonwebtoken'
import { prisma } from './db.js'
import { clearSessionCookie, cookieName, jwtSecret } from './lib.js'

export async function authenticate(req, res, next) {
  const token = req.cookies?.[cookieName]
  if (!token) return res.status(401).json({ error: 'Authentication required.' })

  let payload
  try {
    payload = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'orbit-workspace',
      audience: 'orbit-web',
    })
  } catch {
    clearSessionCookie(res)
    return res.status(401).json({ error: 'Your session is invalid. Please sign in again.' })
  }

  try {
    const session = await prisma.session.findUnique({
      where: { jti: payload.jti },
      include: { user: true },
    })
    if (!session || session.userId !== payload.sub || session.expiresAt <= new Date()) {
      clearSessionCookie(res)
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
    }
    if (session.user.status !== 'ACTIVE') {
      await prisma.session.deleteMany({ where: { userId: session.userId } })
      clearSessionCookie(res)
      return res.status(403).json({ error: 'This account is suspended.' })
    }
    const maintenance = await prisma.systemSetting.findUnique({ where: { key: 'maintenanceMode' } })
    if (maintenance?.value === 'true' && session.user.role !== 'ADMIN') {
      return res.status(503).json({ error: 'The workspace is in maintenance mode. Please try again shortly.' })
    }
    req.user = session.user
    req.session = session
    next()
  } catch (error) {
    next(error)
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Administrator access is required.' })
  next()
}

export function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const origin = req.get('origin')
  const configuredOrigin = process.env.APP_ORIGIN || 'http://localhost:5173'
  if (!origin || origin !== configuredOrigin) return res.status(403).json({ error: 'Request origin is not allowed.' })
  next()
}

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}
