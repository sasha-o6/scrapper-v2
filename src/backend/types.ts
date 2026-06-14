export interface IAppVariables {
  telegramId: bigint
  userId: string
}

export type TAppEnv = {
  Variables: IAppVariables
}
