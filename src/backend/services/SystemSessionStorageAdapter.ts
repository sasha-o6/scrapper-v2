import type { SystemStateService } from '@backend/services/SystemStateService'

export interface IMtcuteSessionClient {
  exportSession(): Promise<string>
  importSession(session: string): Promise<void>
}

export class SystemSessionStorageAdapter {
  public constructor(private readonly systemStateService: SystemStateService) {}

  public async import(client: IMtcuteSessionClient): Promise<void> {
    const state = await this.systemStateService.ensureState()

    if (state.sessionString) {
      await client.importSession(state.sessionString)
    }
  }

  public async persist(client: IMtcuteSessionClient): Promise<void> {
    const sessionString = await client.exportSession()

    await this.systemStateService.update({
      sessionString,
      authStatus: 'LOGGED_IN',
      authorizedAt: new Date()
    })
  }
}
