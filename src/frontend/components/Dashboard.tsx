import { AlertTriangle, History, Pause, Play, Save, ShieldCheck } from 'lucide-preact'
import { memo } from 'preact/compat'

import { ArrayEditor } from '@frontend/components/ArrayEditor'
import { ChannelEditor } from '@frontend/components/ChannelEditor'
import { Toggle } from '@frontend/components/Toggle'
import { useDashboardConfig } from '@frontend/hooks/useDashboardConfig'
import styles from '@frontend/styles/App.module.scss'
import type {
  IConfigDto,
  IConfigUpdatePayload,
  IHistoryPayload,
  IHistoryResultDto
} from '@shared/types'

export interface IDashboardProps {
  config: IConfigDto
  isSaving: boolean
  userName: string
  onSave(payload: IConfigUpdatePayload): Promise<IConfigDto>
  onCollectHistory(payload: IHistoryPayload): Promise<IHistoryResultDto>
}

export const Dashboard = memo(
  ({ config, isSaving, userName, onSave, onCollectHistory }: IDashboardProps) => {
    const dashboard = useDashboardConfig({ config, onSave, onCollectHistory })

    return (
      <div className={styles.dashboard}>
        <section className={styles.summaryBand}>
          <div>
            <p className={styles.kicker}>{userName || config.telegramId}</p>
            <h2>Моніторинг каналів</h2>
          </div>
          <div className={styles.toolbar}>
            <Toggle
              checked={dashboard.draft.isActive}
              label={dashboard.draft.isActive ? 'Active' : 'Pause'}
              onChange={dashboard.setIsActive}
            />
            <button
              className={styles.primaryButton}
              type="button"
              title="Зберегти"
              disabled={!dashboard.isDirty || isSaving}
              onClick={() => void dashboard.save()}
            >
              <Save size={18} />
              <span>{isSaving ? 'Збереження' : 'Зберегти'}</span>
            </button>
          </div>
        </section>

        {!config.isAuthorized ? (
          <section className={styles.warningBand}>
            <AlertTriangle size={18} />
            <p>Центральний userbot не авторизований. Адмін має написати /login основному боту.</p>
          </section>
        ) : null}

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Маршрутизація</h3>
            {dashboard.draft.isActive ? <Play size={18} /> : <Pause size={18} />}
          </div>
          <label className={styles.field}>
            <span>Цільовий чат</span>
            <input
              className={styles.input}
              value={dashboard.draft.targetChat}
              placeholder="@chat або -100..."
              onInput={(event) => dashboard.setTargetChat(event.currentTarget.value)}
            />
          </label>
        </section>

        <section className={styles.gridSection}>
          <ChannelEditor
            items={dashboard.draft.channels}
            title={dashboard.pendingChannel.title}
            value={dashboard.pendingChannel.value}
            onTitleChange={dashboard.setPendingChannelTitle}
            onValueChange={dashboard.setPendingChannelValue}
            onAdd={dashboard.addChannel}
            onRemove={dashboard.removeChannel}
          />
          <ArrayEditor
            label="Ключові слова"
            placeholder="Тригер"
            items={dashboard.draft.keyWords}
            onAdd={(value) => dashboard.addListItem('keyWords', value)}
            onRemove={(value) => dashboard.removeListItem('keyWords', value)}
          />
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Точніший пошук</h3>
            <ShieldCheck size={18} />
          </div>
          <Toggle
            checked={dashboard.draft.strictMode}
            label={dashboard.draft.strictMode ? 'Увімкнено' : 'Вимкнено'}
            onChange={dashboard.setStrictMode}
          />
        </section>

        <section className={styles.gridSection}>
          {dashboard.draft.strictMode ? (
            <ArrayEditor
              label="Додаткові слова"
              placeholder="Обов'язкова умова"
              items={dashboard.draft.additionalWords}
              onAdd={(value) => dashboard.addListItem('additionalWords', value)}
              onRemove={(value) => dashboard.removeListItem('additionalWords', value)}
            />
          ) : null}
          <ArrayEditor
            label="Бан-слова"
            placeholder="Блокувальник"
            items={dashboard.draft.banWords}
            onAdd={(value) => dashboard.addListItem('banWords', value)}
            onRemove={(value) => dashboard.removeListItem('banWords', value)}
          />
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Історія</h3>
            <History size={18} />
          </div>
          <div className={styles.historyRow}>
            <label className={styles.field}>
              <span>Глибина, днів</span>
              <input
                className={styles.input}
                type="number"
                min={1}
                max={365}
                value={dashboard.draft.historyDepthDays}
                onInput={(event) =>
                  dashboard.setHistoryDepthDays(Number(event.currentTarget.value))
                }
              />
            </label>
            <button
              className={styles.secondaryButton}
              type="button"
              title="Зібрати історію"
              onClick={() => void dashboard.collectHistory()}
            >
              <History size={18} />
              <span>Зібрати</span>
            </button>
          </div>
          {dashboard.historyMessage ? (
            <p className={styles.successText}>{dashboard.historyMessage}</p>
          ) : null}
        </section>
      </div>
    )
  }
)
