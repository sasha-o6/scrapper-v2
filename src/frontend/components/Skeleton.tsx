import { memo } from 'preact/compat'

import styles from '@frontend/styles/App.module.scss'

export const Skeleton = memo(() => (
  <div className={styles.skeletonStack} aria-busy="true">
    <div className={styles.skeletonLine} />
    <div className={styles.skeletonBlock} />
    <div className={styles.skeletonGrid}>
      <div className={styles.skeletonBlock} />
      <div className={styles.skeletonBlock} />
    </div>
  </div>
))
