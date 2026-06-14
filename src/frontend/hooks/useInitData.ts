import { useEffect, useMemo } from 'preact/hooks'

interface IInitDataResult {
  initData: string
  userName: string
  isTelegram: boolean
}

export const useInitData = (): IInitDataResult => {
  const webApp = typeof window === 'undefined' ? undefined : window.Telegram?.WebApp

  useEffect(() => {
    webApp?.ready()
    webApp?.expand()
  }, [webApp])

  return useMemo(() => {
    const user = webApp?.initDataUnsafe.user
    const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ')

    return {
      initData: webApp?.initData ?? import.meta.env.VITE_DEV_INIT_DATA ?? '',
      userName: displayName || user?.username || '',
      isTelegram: Boolean(webApp?.initData)
    }
  }, [webApp])
}
