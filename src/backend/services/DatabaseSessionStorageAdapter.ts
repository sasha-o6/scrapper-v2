import type { PrismaClient } from '@prisma/client'

export interface IMtcuteSessionClient {
  exportSession(): Promise<string>
  importSession(session: string): Promise<void>
}

export class DatabaseSessionStorageAdapter {
  public constructor(private readonly db: PrismaClient) {}

  public async importForUser(userId: string, client: IMtcuteSessionClient): Promise<void> {
    const session = await this.db.session.findUnique({ where: { userId } })

    if (session?.sessionString) {
      await client.importSession(session.sessionString)
    }
  }

  public async persistForUser(userId: string, client: IMtcuteSessionClient): Promise<void> {
    const sessionString = await client.exportSession()

    await this.db.session.upsert({
      where: { userId },
      create: {
        userId,
        sessionString,
        authorizedAt: new Date()
      },
      update: {
        sessionString,
        authorizedAt: new Date()
      }
    })
  }
}
