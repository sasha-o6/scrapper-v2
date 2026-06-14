interface ITelegramWebAppUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

interface ITelegramWebApp {
  initData: string
  initDataUnsafe: {
    user?: ITelegramWebAppUser
  }
  ready(): void
  expand(): void
}

interface Window {
  Telegram?: {
    WebApp: ITelegramWebApp
  }
}
