import { PrismaClient } from '@prisma/client'

import { env } from '@backend/env'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: env.databaseUrl
      }
    },
    log: env.nodeEnv === 'development' ? ['warn', 'error'] : ['error']
  })

if (env.nodeEnv !== 'production') {
  globalForPrisma.prisma = prisma
}
