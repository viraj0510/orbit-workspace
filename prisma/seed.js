import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || (process.env.NODE_ENV === 'production' ? '' : 'admin@orbit.local')).trim().toLowerCase()
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'AdminDemo!2026')
  let userEmail = (process.env.SEED_USER_EMAIL || (process.env.NODE_ENV === 'production' ? '' : 'user@orbit.local')).trim().toLowerCase()
  let userPassword = process.env.SEED_USER_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'UserDemo!2026')

  if (!adminEmail || !adminPassword || adminPassword.length < 12 || (process.env.NODE_ENV === 'production' && (adminEmail === 'admin@orbit.local' || adminPassword === 'AdminDemo!2026'))) {
    throw new Error('Set a unique SEED_ADMIN_EMAIL and a SEED_ADMIN_PASSWORD of at least 12 characters before seeding production.')
  }
  if (process.env.NODE_ENV === 'production' && (userEmail === 'user@orbit.local' || userPassword === 'UserDemo!2026')) {
    userEmail = ''
    userPassword = ''
  }
  if (process.env.NODE_ENV !== 'production' && (!userEmail || !userPassword)) {
    throw new Error('Set both demo user credentials or use the defaults from .env.example.')
  }

  const adminHash = await bcrypt.hash(adminPassword, 12)
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: 'Orbit Administrator', role: 'ADMIN', status: 'ACTIVE' },
    create: { name: 'Orbit Administrator', email: adminEmail, passwordHash: adminHash, role: 'ADMIN', status: 'ACTIVE', emailVerified: true },
  })

  let user = null
  if (userEmail && userPassword) {
    const userHash = await bcrypt.hash(userPassword, 12)
    user = await prisma.user.upsert({
      where: { email: userEmail },
      update: { name: 'Taylor Morgan', status: 'ACTIVE' },
      create: { name: 'Taylor Morgan', email: userEmail, passwordHash: userHash, role: 'USER', status: 'ACTIVE', emailVerified: true },
    })
  }

  const settings = [
    ['platformName', 'Orbit Workspace'],
    ['allowRegistrations', 'true'],
    ['maintenanceMode', 'false'],
    ['requireGoogleForAdmins', 'false'],
  ]
  for (const [key, value] of settings) {
    await prisma.systemSetting.upsert({ where: { key }, update: {}, create: { key, value } })
  }

  if (user && await prisma.project.count() === 0) {
    await prisma.project.createMany({ data: [
      { name: 'Q3 customer onboarding', description: 'Refresh the onboarding flow and reduce time to first value.', status: 'IN_PROGRESS', priority: 'HIGH', dueAt: new Date(Date.now() + 8 * 86400000), ownerId: user.id },
      { name: 'Workspace analytics', description: 'Build a clearer weekly usage report for the product team.', status: 'REVIEW', priority: 'MEDIUM', dueAt: new Date(Date.now() + 14 * 86400000), ownerId: user.id },
      { name: 'Help center refresh', description: 'Organize support content and update the top ten guides.', status: 'PLANNING', priority: 'LOW', dueAt: new Date(Date.now() + 26 * 86400000), ownerId: user.id },
      { name: 'Mobile release checklist', description: 'Coordinate final QA and release readiness across teams.', status: 'DONE', priority: 'MEDIUM', dueAt: new Date(Date.now() - 2 * 86400000), ownerId: user.id },
    ] })
  }

  if (await prisma.auditLog.count() === 0) {
    await prisma.auditLog.create({ data: { actorId: admin.id, actorEmail: admin.email, action: 'SYSTEM_SEEDED', entity: 'SYSTEM', metadata: JSON.stringify({ source: 'development seed' }) } })
  }

  console.log(`Seed ready. Admin: ${admin.email}${user ? ` · Demo user: ${user.email}` : ''}`)
  if (process.env.NODE_ENV !== 'production') console.log('Development demo credentials are documented in README.md.')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
}).finally(async () => {
  await prisma.$disconnect()
})
