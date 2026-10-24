import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { asyncHandler } from '../middleware.js'
import { audit } from '../lib.js'

const router = Router()
const statuses = ['PLANNING', 'IN_PROGRESS', 'REVIEW', 'DONE']
const priorities = ['LOW', 'MEDIUM', 'HIGH']
const projectSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1200).default(''),
  status: z.enum(statuses).default('PLANNING'),
  priority: z.enum(priorities).default('MEDIUM'),
  dueAt: z.string().nullable().optional(),
}).strict()

function listFilter(value, values) {
  return values.includes(value) ? value : undefined
}

router.get('/', asyncHandler(async (req, res) => {
  const page = Math.max(1, Math.min(1000, Number.parseInt(req.query.page, 10) || 1))
  const pageSize = Math.max(1, Math.min(50, Number.parseInt(req.query.pageSize, 10) || 8))
  const q = String(req.query.q || '').trim().slice(0, 100)
  const status = listFilter(String(req.query.status || ''), statuses)
  const priority = listFilter(String(req.query.priority || ''), priorities)
  const where = {
    ...(req.user.role === 'ADMIN' ? {} : { ownerId: req.user.id }),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(q ? { OR: [{ name: { contains: q } }, { description: { contains: q } }, { owner: { name: { contains: q } } }] } : {}),
  }
  const [total, projects] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      include: { owner: { select: { id: true, name: true, email: true } } },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])
  res.json({ projects, page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) })
}))

router.post('/', asyncHandler(async (req, res) => {
  const parsed = projectSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
  const dueAt = parsed.data.dueAt ? new Date(parsed.data.dueAt) : null
  if (dueAt && Number.isNaN(dueAt.getTime())) return res.status(400).json({ error: 'Choose a valid due date.' })
  const project = await prisma.project.create({
    data: {
      ...parsed.data,
      dueAt,
      ownerId: req.user.id,
    },
    include: { owner: { select: { id: true, name: true, email: true } } },
  })
  await audit(req, req.user, 'PROJECT_CREATED', 'PROJECT', project.id, { name: project.name })
  res.status(201).json({ project })
}))

router.patch('/:id', asyncHandler(async (req, res) => {
  const schema = projectSchema.partial().strict()
  const parsed = schema.safeParse(req.body)
  if (!parsed.success || !Object.keys(parsed.data || {}).length) return res.status(400).json({ error: 'Provide valid project fields to update.' })
  const existing = await prisma.project.findUnique({ where: { id: req.params.id } })
  if (!existing) return res.status(404).json({ error: 'Project not found.' })
  if (existing.ownerId !== req.user.id && req.user.role !== 'ADMIN') return res.status(403).json({ error: 'You do not have access to this project.' })
  const dueAt = parsed.data.dueAt === undefined ? undefined : parsed.data.dueAt ? new Date(parsed.data.dueAt) : null
  if (dueAt && Number.isNaN(dueAt.getTime())) return res.status(400).json({ error: 'Choose a valid due date.' })
  const project = await prisma.project.update({
    where: { id: existing.id },
    data: { ...parsed.data, ...(parsed.data.dueAt !== undefined ? { dueAt } : {}) },
    include: { owner: { select: { id: true, name: true, email: true } } },
  })
  await audit(req, req.user, 'PROJECT_UPDATED', 'PROJECT', project.id, { name: project.name })
  res.json({ project })
}))

router.delete('/:id', asyncHandler(async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id } })
  if (!project) return res.status(404).json({ error: 'Project not found.' })
  if (project.ownerId !== req.user.id && req.user.role !== 'ADMIN') return res.status(403).json({ error: 'You do not have access to this project.' })
  await prisma.project.delete({ where: { id: project.id } })
  await audit(req, req.user, 'PROJECT_DELETED', 'PROJECT', project.id, { name: project.name })
  res.json({ ok: true })
}))

export default router
