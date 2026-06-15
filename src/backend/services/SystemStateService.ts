import type { Prisma, PrismaClient, SystemState } from '@prisma/client'

import type { TSystemAuthStatus } from '@shared/types'

export const SYSTEM_STATE_ID = 1

export class SystemStateService {
  public constructor(private readonly db: PrismaClient) {}

  public async ensureState(): Promise<SystemState> {
    return this.db.systemState.upsert({
      where: { id: SYSTEM_STATE_ID },
      create: { id: SYSTEM_STATE_ID },
      update: {}
    })
  }

  public async getStatus(): Promise<TSystemAuthStatus> {
    const state = await this.ensureState()

    return state.authStatus
  }

  public async isLoggedIn(): Promise<boolean> {
    return (await this.getStatus()) === 'LOGGED_IN'
  }

  public async update(data: Prisma.SystemStateUpdateInput): Promise<SystemState> {
    await this.ensureState()

    return this.db.systemState.update({
      where: { id: SYSTEM_STATE_ID },
      data
    })
  }
}
