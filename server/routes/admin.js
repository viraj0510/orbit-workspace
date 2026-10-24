import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../db.js'
import { asyncHandler } from '../middleware.js'
import { audit, publicUser } from '../lib.js'

const router = Router()
const emailSchema = z.string().trim().email().max(180).transform(value => value.toLowerCase())
const passwordSchema = z.string().min(12).max(72)

router.get('/metrics', asyncHandler(async (_req, res) => {
  const now = new Date()
  const since = new Date(now.getTime() - 7 * 86400000)
  const [totalUsers, activeUsers, suspendedUsers, activeSessions, projects, newUsers, recentEvents, projectGroups] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({ where: { status: 'SUSPENDED' } }),
    prisma.session.count({ where: { expiresAt: { gt: now }, user: { status: 'ACTIVE' } } }),
    prisma.project.count(),
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.auditLog.findMany({ where: { action: { in: ['LOGIN_FAILED', 'USER_SUSPENDED', 'USER_DELETED', 'ADMIN_ROLE_CHANGED'] } }, orderBy: { createdAt: 'desc' }, take: 6 }),
    prisma.project.groupBy({ by: ['status'], _count: { _all: true } }),
  ])
  const growth = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now)
    day.setDate(now.getDate() - (6 - index))
    day.setHours(0, 0, 0, 0)
    const next = new Date(day)
    next.setDate(day.getDate() + 1)
    return { label: day.toLocaleDateString('en-US', { weekday: 'short' }), users: newUsers.filter(row => row.createdAt >= day && row.createdAt < next).length }
  })
  res.json({
    metrics: { totalUsers, activeUsers, suspendedUsers, activeSessions, projects, health: 99.98 },
    growth,
    projectStatus: projectGroups.map(group => ({ status: group.status, count: group._count._all })),
    alerts: recentEvents,
  })
}))

router.get('/users', asyncHandler(async (req, res) => {
  const page = Math.max(1, Math.min(1000, Number.parseInt(req.query.page, 10) || 1))
  const pageSize = Math.max(1, Math.min(50, Number.parseInt(req.query.pageSize, 10) || 10))
  const q = String(req.query.q || '').trim().slice(0, 100)
  const role = ['ADMIN', 'USER'].includes(String(req.query.role || '')) ? String(req.query.role) : undefined
  const status = ['ACTIVE', 'SUSPENDED'].includes(String(req.query.status || '')) ? String(req.query.status) : undefined
  const where = {
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}),
  }
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: { _count: { select: { projects: true } }, sessions: { select: { createdAt: true, expiresAt: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])
  res.json({
    users: users.map(user => ({ ...publicUser(user), projectCount: user._count.projects, lastSessionAt: user.sessions[0]?.createdAt || null, sessionExpiresAt: user.sessions[0]?.expiresAt || null })),
    page,
    pageSize,
    total,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  })
}))

router.post('/users', asyncHandler(async (req, res) => {
  const schema = z.object({ name: z.string().trim().min(2).max(80), email: emailSchema, password: passwordSchema, role: z.enum(['USER', 'ADMIN']).default('USER') }).strict()
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
  if (await prisma.user.findUnique({ where: { email: parsed.data.email } })) return res.status(409).json({ error: 'An account with that email already exists.' })
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      role: parsed.data.role,
      emailVerified: true,
      preferences: JSON.stringify({ emailUpdates: true, productNews: false, securityAlerts: true }),
    },
  })
  await audit(req, req.user, 'USER_CREATED', 'USER', user.id, { email: user.email, role: user.role })
  res.status(201).json({ user: publicUser(user) })
}))

router.patch('/users/:id', asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(2).max(80).optional(),
    email: emailSchema.optional(),
    role: z.enum(['USER', 'ADMIN']).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  }).strict()
  const parsed = schema.safeParse(req.body)
  if (!parsed.success || !Object.keys(parsed.data || {}).length) return res.status(400).json({ error: 'Provide valid account fields to update.' })
  const current = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!current) return res.status(404).json({ error: 'User not found.' })
  if (current.id === req.user.id && (parsed.data.role === 'USER' || parsed.data.status === 'SUSPENDED')) return res.status(400).json({ error: 'You cannot remove your own administrator access or suspend your own account.' })
  if (parsed.data.email && parsed.data.email !== current.email && await prisma.user.findUnique({ where: { email: parsed.data.email } })) return res.status(409).json({ error: 'That email address is already in use.' })

  const losingActiveAdmin = current.role === 'ADMIN' && current.status === 'ACTIVE' && ((parsed.data.role && parsed.data.role !== 'ADMIN') || (parsed.data.status && parsed.data.status !== 'ACTIVE'))
  if (losingActiveAdmin && await prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } }) <= 1) return res.status(409).json({ error: 'Keep at least one active administrator.' })

  const updated = await prisma.$transaction(async transaction => {
    const result = await transaction.user.update({ where: { id: current.id }, data: parsed.data })
    if (result.status === 'SUSPENDED') await transaction.session.deleteMany({ where: { userId: result.id } })
    return result
  })
  const action = updated.status === 'SUSPENDED' && current.status !== 'SUSPENDED'
    ? 'USER_SUSPENDED'
    : parsed.data.role && parsed.data.role !== current.role
      ? 'ADMIN_ROLE_CHANGED'
      : 'USER_UPDATED'
  await audit(req, req.user, action, 'USER', updated.id, { fromRole: current.role, toRole: updated.role, status: updated.status })
  res.json({ user: publicUser(updated) })
}))

router.delete('/users/:id', asyncHandler(async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!target) return res.status(404).json({ error: 'User not found.' })
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account from the admin console.' })
  if (target.role === 'ADMIN' && target.status === 'ACTIVE' && await prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } }) <= 1) return res.status(409).json({ error: 'Keep at least one active administrator.' })
  await audit(req, req.user, 'USER_DELETED', 'USER', target.id, { email: target.email })
  await prisma.user.delete({ where: { id: target.id } })
  res.json({ ok: true })
}))

router.get('/logs', asyncHandler(async (req, res) => {
  const page = Math.max(1, Math.min(1000, Number.parseInt(req.query.page, 10) || 1))
  const pageSize = Math.max(1, Math.min(100, Number.parseInt(req.query.pageSize, 10) || 20))
  const q = String(req.query.q || '').trim().slice(0, 100)
  const action = String(req.query.action || '').trim().slice(0, 80)
  const where = {
    ...(action ? { action: { contains: action } } : {}),
    ...(q ? { OR: [{ actorEmail: { contains: q } }, { action: { contains: q } }, { entity: { contains: q } }] } : {}),
  }
  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
  ])
  res.json({ logs, page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) })
}))

const settingKeys = ['platformName', 'allowRegistrations', 'maintenanceMode', 'requireGoogleForAdmins']
router.get('/settings', asyncHandler(async (_req, res) => {
  const rows = await prisma.systemSetting.findMany({ where: { key: { in: settingKeys } } })
  const settings = Object.fromEntries(rows.map(row => [row.key, row.value]))
  res.json({ settings: {
    platformName: settings.platformName || 'Orbit Workspace',
    allowRegistrations: settings.allowRegistrations !== 'false',
    maintenanceMode: settings.maintenanceMode === 'true',
    requireGoogleForAdmins: settings.requireGoogleForAdmins === 'true',
  } })
}))

router.patch('/settings', asyncHandler(async (req, res) => {
  const schema = z.object({
    platformName: z.string().trim().min(2).max(60).optional(),
    allowRegistrations: z.boolean().optional(),
    maintenanceMode: z.boolean().optional(),
    requireGoogleForAdmins: z.boolean().optional(),
  }).strict()
  const parsed = schema.safeParse(req.body)
  if (!parsed.success || !Object.keys(parsed.data || {}).length) return res.status(400).json({ error: 'Provide valid platform settings.' })
  for (const [key, value] of Object.entries(parsed.data)) {
    await prisma.systemSetting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } })
  }
  await audit(req, req.user, 'SYSTEM_SETTINGS_UPDATED', 'SYSTEM', null, parsed.data)
  const rows = await prisma.systemSetting.findMany({ where: { key: { in: settingKeys } } })
  const settings = Object.fromEntries(rows.map(row => [row.key, row.value]))
  res.json({ settings: {
    platformName: settings.platformName || 'Orbit Workspace',
    allowRegistrations: settings.allowRegistrations !== 'false',
    maintenanceMode: settings.maintenanceMode === 'true',
    requireGoogleForAdmins: settings.requireGoogleForAdmins === 'true',
  } })
}))

export default router
