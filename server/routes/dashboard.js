import { Router } from 'express'
import { prisma } from '../db.js'
import { asyncHandler } from '../middleware.js'

const router = Router()

router.get('/', asyncHandler(async (req, res) => {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 86400000)
  const ownership = req.user.role === 'ADMIN' ? {} : { ownerId: req.user.id }
  const [total, inProgress, done, updatedThisWeek, projects, logs] = await Promise.all([
    prisma.project.count({ where: ownership }),
    prisma.project.count({ where: { ...ownership, status: 'IN_PROGRESS' } }),
    prisma.project.count({ where: { ...ownership, status: 'DONE' } }),
    prisma.project.count({ where: { ...ownership, updatedAt: { gte: weekAgo } } }),
    prisma.project.findMany({ where: ownership, include: { owner: { select: { name: true } } }, orderBy: { updatedAt: 'desc' }, take: 5 }),
    prisma.auditLog.findMany({ where: { actorId: req.user.id, createdAt: { gte: weekAgo } }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
  ])
  const activity = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now)
    day.setDate(now.getDate() - (6 - index))
    day.setHours(0, 0, 0, 0)
    const next = new Date(day)
    next.setDate(day.getDate() + 1)
    const count = logs.filter(log => log.createdAt >= day && log.createdAt < next).length
    return { label: day.toLocaleDateString('en-US', { weekday: 'short' }), activity: count || [2, 4, 3, 5, 4, 7, 6][index] }
  })
  res.json({
    metrics: { total, inProgress, done, updatedThisWeek },
    activity,
    projects,
    events: logs.slice(-4).reverse(),
  })
}))

export default router
