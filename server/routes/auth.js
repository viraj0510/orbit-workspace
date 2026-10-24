import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { OAuth2Client } from 'google-auth-library'
import { z } from 'zod'
import { prisma } from '../db.js'
import { asyncHandler, authenticate } from '../middleware.js'
import { audit, clearSessionCookie, createSession, getSetting, publicUser } from '../lib.js'

const router = Router()
const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || ''
const googleClient = new OAuth2Client(googleClientId)
const dummyPasswordHash = bcrypt.hashSync('orbit-invalid-login-compare-only', 12)

const emailSchema = z.string().trim().email().max(180).transform(value => value.toLowerCase())
const passwordSchema = z.string().min(12, 'Use at least 12 characters.').max(72, 'Password must be 72 characters or fewer.')
const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  password: passwordSchema,
}).strict()
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(72) }).strict()

router.post('/register', asyncHandler(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
  if (await getSetting('maintenanceMode', 'false') === 'true') return res.status(503).json({ error: 'New registrations are paused during workspace maintenance.' })
  if (await getSetting('allowRegistrations', 'true') !== 'true') return res.status(403).json({ error: 'New account registration is currently closed.' })

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) return res.status(409).json({ error: 'An account with that email already exists.' })

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      preferences: JSON.stringify({ emailUpdates: true, productNews: false, securityAlerts: true }),
    },
  })
  await createSession(req, res, user)
  await audit(req, user, 'ACCOUNT_REGISTERED', 'USER', user.id)
  res.status(201).json({ user: publicUser(user) })
}))

router.post('/login', asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and password.' })

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  const passwordIsValid = await bcrypt.compare(parsed.data.password, user?.passwordHash || dummyPasswordHash)
  if (!user || !passwordIsValid) {
    await audit(req, { email: parsed.data.email }, 'LOGIN_FAILED', 'AUTH')
    return res.status(401).json({ error: 'Email or password is incorrect.' })
  }
  if (user.status !== 'ACTIVE') return res.status(403).json({ error: 'This account is suspended. Contact your administrator.' })
  if (user.role !== 'ADMIN' && await getSetting('maintenanceMode', 'false') === 'true') return res.status(503).json({ error: 'The workspace is in maintenance mode. Please try again shortly.' })
  if (user.role === 'ADMIN' && await getSetting('requireGoogleForAdmins', 'false') === 'true') {
    return res.status(403).json({ error: 'Administrator accounts must sign in with Google.' })
  }

  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } })
  await createSession(req, res, user)
  await audit(req, user, 'LOGIN_SUCCESS', 'AUTH')
  res.json({ user: publicUser(user) })
}))

router.post('/google', asyncHandler(async (req, res) => {
  if (!googleClientId || googleClientId.startsWith('your-')) return res.status(503).json({ error: 'Google sign-in is not configured. Add GOOGLE_CLIENT_ID to the server environment.' })
  const credential = z.string().min(20).max(5000).safeParse(req.body?.credential)
  if (!credential.success) return res.status(400).json({ error: 'Google credential is missing or invalid.' })

  let claims
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential.data, audience: googleClientId })
    claims = ticket.getPayload()
  } catch {
    return res.status(401).json({ error: 'Google could not verify this sign-in. Please try again.' })
  }
  if (!claims?.sub || !claims.email || claims.email_verified !== true) {
    return res.status(403).json({ error: 'A verified Google email is required.' })
  }

  const email = claims.email.toLowerCase()
  let user = await prisma.user.findUnique({ where: { googleSub: claims.sub } })
  if (!user) {
    const byEmail = await prisma.user.findUnique({ where: { email } })
    if (byEmail?.googleSub && byEmail.googleSub !== claims.sub) return res.status(409).json({ error: 'That account is connected to a different Google identity.' })
    if (await getSetting('maintenanceMode', 'false') === 'true' && (!byEmail || byEmail.role !== 'ADMIN')) return res.status(503).json({ error: 'The workspace is in maintenance mode. Please try again shortly.' })
    if (!byEmail && await getSetting('allowRegistrations', 'true') !== 'true') return res.status(403).json({ error: 'New account registration is currently closed.' })
    user = byEmail
      ? await prisma.user.update({ where: { id: byEmail.id }, data: { googleSub: claims.sub, emailVerified: true, avatarUrl: claims.picture || byEmail.avatarUrl } })
      : await prisma.user.create({
        data: {
          name: claims.name?.slice(0, 80) || email.split('@')[0],
          email,
          googleSub: claims.sub,
          avatarUrl: claims.picture || null,
          emailVerified: true,
          preferences: JSON.stringify({ emailUpdates: true, productNews: false, securityAlerts: true }),
        },
      })
  }
  if (user.status !== 'ACTIVE') return res.status(403).json({ error: 'This account is suspended. Contact your administrator.' })
  if (user.role !== 'ADMIN' && await getSetting('maintenanceMode', 'false') === 'true') return res.status(503).json({ error: 'The workspace is in maintenance mode. Please try again shortly.' })

  await createSession(req, res, user)
  await audit(req, user, 'GOOGLE_LOGIN_SUCCESS', 'AUTH')
  res.json({ user: publicUser(user) })
}))

router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  await prisma.session.delete({ where: { id: req.session.id } })
  await audit(req, req.user, 'LOGOUT', 'AUTH')
  clearSessionCookie(res)
  res.json({ ok: true })
}))

router.get('/me', authenticate, (req, res) => {
  res.json({ user: publicUser(req.user), sessionExpiresAt: req.session.expiresAt })
})

router.patch('/profile', authenticate, asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(2).max(80).optional(),
    preferences: z.object({
      emailUpdates: z.boolean().optional(),
      productNews: z.boolean().optional(),
      securityAlerts: z.boolean().optional(),
    }).strict().optional(),
  }).strict()
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Profile details are invalid.' })

  let oldPreferences = {}
  try { oldPreferences = JSON.parse(req.user.preferences || '{}') } catch { oldPreferences = {} }
  const preferences = { ...oldPreferences, ...parsed.data.preferences }
  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.preferences ? { preferences: JSON.stringify(preferences) } : {}),
    },
  })
  await audit(req, updated, 'PROFILE_UPDATED', 'USER', updated.id)
  res.json({ user: publicUser(updated) })
}))

router.post('/password', authenticate, asyncHandler(async (req, res) => {
  const schema = z.object({
    currentPassword: z.string().max(72).optional(),
    newPassword: passwordSchema,
  }).strict()
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
  if (req.user.passwordHash && (!parsed.data.currentPassword || !await bcrypt.compare(parsed.data.currentPassword, req.user.passwordHash))) {
    return res.status(400).json({ error: 'Your current password is incorrect.' })
  }
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12)
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } })
  await prisma.session.deleteMany({ where: { userId: req.user.id, NOT: { id: req.session.id } } })
  await audit(req, req.user, 'PASSWORD_CHANGED', 'USER', req.user.id)
  res.json({ ok: true, message: 'Password updated. Other sessions were signed out.' })
}))

export default router
