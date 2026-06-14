import { Suspense } from 'preact/compat'
import { useMemo } from 'preact/hooks'

import { Skeleton } from '@frontend/components/Skeleton'
import type { IAuthPanelProps } from '@frontend/components/AuthPanel'
import type { IDashboardProps } from '@frontend/components/Dashboard'
import { useApiClient } from '@frontend/hooks/useApiClient'
import { useAuthFlow } from '@frontend/hooks/useAuthFlow'
import { useConfig } from '@frontend/hooks/useConfig'
import { useInitData } from '@frontend/hooks/useInitData'
import styles from '@frontend/styles/App.module.scss'
import { dynamic } from '@frontend/utils/dynamic'

const AuthPanel = dynamic<IAuthPanelProps>(() =>
  import('@frontend/components/AuthPanel').then((module) => ({ default: module.AuthPanel }))
)

const Dashboard = dynamic<IDashboardProps>(() =>
  import('@frontend/components/Dashboard').then((module) => ({ default: module.Dashboard }))
)

export const App = () => {
  const initData = useInitData()
  const apiClient = useApiClient(initData.initData)
  const configState = useConfig(apiClient)
  const authFlow = useAuthFlow({
    apiClient,
    onAuthorized: configState.loadConfig
  })

  const statusText = useMemo(() => {
    if (!initData.isTelegram) {
      return 'Local'
    }

    return configState.config?.isActive ? 'Active' : 'Pause'
  }, [configState.config?.isActive, initData.isTelegram])

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div>
          <p className={styles.kicker}>Telegram Monitor</p>
          <h1>Userbot TMA</h1>
        </div>
        <span className={styles.statusPill}>{statusText}</span>
      </header>

      <Suspense fallback={<Skeleton />}>
        {configState.isLoading ? <Skeleton /> : null}
        {!configState.isLoading && configState.error ? (
          <section className={styles.section}>
            <p className={styles.errorText}>{configState.error}</p>
          </section>
        ) : null}
        {!configState.isLoading && configState.config && !configState.config.isAuthorized ? (
          <AuthPanel authFlow={authFlow} />
        ) : null}
        {!configState.isLoading && configState.config?.isAuthorized ? (
          <Dashboard
            config={configState.config}
            isSaving={configState.isSaving}
            userName={initData.userName}
            onSave={configState.saveConfig}
            onCollectHistory={configState.collectHistory}
          />
        ) : null}
      </Suspense>
    </main>
  )
}
