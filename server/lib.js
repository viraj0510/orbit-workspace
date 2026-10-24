import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { prisma } from './db.js'

const developmentSecret = 'orbit-local-development-secret-change-before-deploying-2026'
export const jwtSecret = process.env.JWT_SECRET || developmentSecret
export const cookieName = process.env.COOKIE_NAME || 'orbit_session'
export const sessionDuration = process.env.JWT_EXPIRES_IN || '7d'
const allowedDurations = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }

export function durationMilliseconds(value = sessionDuration) {
  const match = String(value).match(/^(\d+)([smhd])$/)
  if (!match) return 7 * 86_400_000
  return Number(match[1]) * allowedDurations[match[2]]
}

export function cookieOptions(maxAge = durationMilliseconds()) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  }
}

export function clearSessionCookie(res) {
  res.clearCookie(cookieName, { ...cookieOptions(), maxAge: undefined })
}

export function publicUser(user) {
  let preferences = {}
  try { preferences = JSON.parse(user.preferences || '{}') } catch { preferences = {} }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    googleConnected: Boolean(user.googleSub),
    hasPassword: Boolean(user.passwordHash),
    preferences,
    createdAt: user.createdAt,
  }
}

export async function createSession(req, res, user) {
  const jti = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + durationMilliseconds())
  await prisma.session.create({
    data: {
      jti,
      userId: user.id,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')?.slice(0, 400) || null,
    },
  })
  const token = jwt.sign({ jti }, jwtSecret, {
    algorithm: 'HS256',
    subject: user.id,
    issuer: 'orbit-workspace',
    audience: 'orbit-web',
    expiresIn: sessionDuration,
  })
  res.cookie(cookieName, token, cookieOptions())
}

export async function audit(req, actor, action, entity, entityId = null, metadata = null) {
  await prisma.auditLog.create({
    data: {
      actorId: actor?.id || null,
      actorEmail: actor?.email || null,
      action,
      entity,
      entityId,
      ipAddress: req.ip,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  })
}

export async function getSetting(key, fallback = '') {
  const setting = await prisma.systemSetting.findUnique({ where: { key } })
  return setting?.value ?? fallback
}

export function assertRuntimeConfiguration() {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET === developmentSecret || process.env.JWT_SECRET.startsWith('replace-with-')) {
      throw new Error('Production requires a unique JWT_SECRET of at least 32 characters.')
    }
    if (!process.env.APP_ORIGIN) throw new Error('Production requires APP_ORIGIN to match the public site origin.')
    if (new URL(process.env.APP_ORIGIN).protocol !== 'https:') throw new Error('Production APP_ORIGIN must use HTTPS.')
    if (!process.env.ORIGIN_VERIFY_TOKEN || process.env.ORIGIN_VERIFY_TOKEN.length < 32) throw new Error('Production requires an ORIGIN_VERIFY_TOKEN with at least 32 characters.')
    if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID.startsWith('your-')) console.warn('GOOGLE_CLIENT_ID is not set. Google sign-in will be unavailable.')
  }
}
