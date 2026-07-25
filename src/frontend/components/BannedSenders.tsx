import { ExternalLink, Trash2, UserX } from 'lucide-preact'
import { memo } from 'preact/compat'
import { useCallback } from 'preact/hooks'

import type { IApiClient } from '@frontend/api/client'
import { useBannedSenders } from '@frontend/hooks/useBannedSenders'
import styles from '@frontend/styles/App.module.scss'
import type { IBannedSenderDto } from '@shared/types'

export interface IBannedSendersProps {
  apiClient: IApiClient
}

const getSenderLabel = (item: IBannedSenderDto): string =>
  item.name ?? (item.username ? `@${item.username}` : item.telegramId)

const getSenderLink = (item: IBannedSenderDto): string =>
  item.username ? `https://t.me/${item.username}` : `tg://user?id=${item.telegramId}`

export const BannedSenders = memo(({ apiClient }: IBannedSendersProps) => {
  const bannedSenders = useBannedSenders(apiClient)
  const { remove } = bannedSenders

  const onRemove = useCallback(
    (id: string) => {
      void remove(id)
    },
    [remove]
  )

  return (
    <section className={styles.section} aria-label="Заблоковані користувачі">
      <div className={styles.sectionHeader}>
        <h3>Заблоковані користувачі</h3>
        <UserX size={18} />
      </div>
      {bannedSenders.error ? <p className={styles.errorText}>{bannedSenders.error}</p> : null}
      {bannedSenders.isLoading ? (
        <div className={styles.skeletonStack} aria-busy="true">
          <div className={styles.skeletonLine} />
        </div>
      ) : null}
      {!bannedSenders.isLoading && bannedSenders.items.length === 0 && !bannedSenders.error ? (
        <p className={styles.fieldHint}>
          Список порожній. Блокуйте відправників кнопкою під повідомленнями.
        </p>
      ) : null}
      {!bannedSenders.isLoading && bannedSenders.items.length > 0 ? (
        <div className={styles.list}>
          {bannedSenders.items.map((item) => (
            <div className={styles.listItem} key={item.id}>
              <a
                className={styles.bannedSenderLink}
                href={getSenderLink(item)}
                target="_blank"
                rel="noreferrer"
              >
                <span>{getSenderLabel(item)}</span>
                <ExternalLink size={14} />
              </a>
              <button
                className={styles.ghostIconButton}
                type="button"
                title="Розблокувати"
                onClick={() => onRemove(item.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
})
