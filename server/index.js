import 'dotenv/config'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { prisma } from './db.js'
import { assertRuntimeConfiguration } from './lib.js'
import { asyncHandler, csrfProtection, authenticate, requireAdmin } from './middleware.js'
import authRoutes from './routes/auth.js'
import projectRoutes from './routes/projects.js'
import adminRoutes from './routes/admin.js'
import dashboardRoutes from './routes/dashboard.js'

assertRuntimeConfiguration()

const app = express()
const api = express.Router()
const port = Number(process.env.PORT || 4000)
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1')
const dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.resolve(dirname, '../dist')
const allowedOrigin = process.env.APP_ORIGIN || 'http://localhost:5173'
const originVerifyToken = process.env.ORIGIN_VERIFY_TOKEN || ''
const contentSecurityDirectives = {
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  objectSrc: ["'none'"],
  frameAncestors: ["'none'"],
  scriptSrc: ["'self'", 'https://accounts.google.com'],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
  imgSrc: ["'self'", 'data:', 'https:'],
  connectSrc: ["'self'", 'https://accounts.google.com'],
  frameSrc: ['https://accounts.google.com'],
  formAction: ["'self'"],
}
if (process.env.NODE_ENV === 'production') contentSecurityDirectives.upgradeInsecureRequests = []

if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1)
app.disable('x-powered-by')
app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  contentSecurityPolicy: { directives: contentSecurityDirectives },
}))
app.use(express.json({ limit: '64kb' }))
app.use(cookieParser())
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production' || req.path === '/api/health') return next()
  const suppliedToken = req.get('x-origin-verify') || ''
  const expected = Buffer.from(originVerifyToken)
  const supplied = Buffer.from(suppliedToken)
  if (expected.length < 32 || supplied.length !== expected.length || !crypto.timingSafeEqual(expected, supplied)) {
    return res.status(403).json({ error: 'Request did not come through the configured edge.' })
  }
  next()
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Wait a few minutes and try again.' },
  handler: (req, res, _next, options) => res.status(options.statusCode).json(options.message),
})

api.use(csrfProtection)
api.get('/health', asyncHandler(async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`
  res.json({ status: 'ok', service: 'orbit-api', timestamp: new Date().toISOString() })
}))
api.get('/config', asyncHandler(async (_req, res) => {
  const rows = await prisma.systemSetting.findMany({ where: { key: { in: ['platformName', 'allowRegistrations', 'maintenanceMode'] } } })
  const settings = Object.fromEntries(rows.map(row => [row.key, row.value]))
  res.json({
    platformName: settings.platformName || 'Orbit Workspace',
    allowRegistrations: settings.allowRegistrations !== 'false',
    maintenanceMode: settings.maintenanceMode === 'true',
  })
}))
api.use('/auth', (req, res, next) => {
  if (['/login', '/register', '/google'].includes(req.path) && req.method === 'POST') return authLimiter(req, res, next)
  next()
}, authRoutes)
api.use('/projects', authenticate, projectRoutes)
api.use('/dashboard', authenticate, dashboardRoutes)
api.use('/admin', authenticate, requireAdmin, adminRoutes)
api.use((req, res) => res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` }))
app.use('/api', api)

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distPath, { index: false, maxAge: '1h', immutable: false }))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(distPath, 'index.html'))
  })
} else {
  app.get('/', (_req, res) => res.status(200).type('text').send(`Orbit API is running. Open the Vite app at ${allowedOrigin}.`))
}

app.use((error, _req, res, _next) => {
  if (error?.code === 'P2002') return res.status(409).json({ error: 'That value is already in use.' })
  if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' })
  if (process.env.NODE_ENV !== 'production') console.error(error)
  res.status(500).json({ error: 'Something went wrong. Please try again.' })
})

const server = app.listen(port, host, () => {
  console.log(`Orbit API listening on http://localhost:${port}`)
})

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
