import { BaseGlobalNav, BongoDbLogo, BongoLogoMark } from '@liam-hq/ui'
import type { FC } from 'react'
import styles from './PublicGlobalNav.module.css'

export const PublicGlobalNav: FC = () => {
  return (
    <BaseGlobalNav
      enableHover={false}
      logoSection={
        <>
          <div className={styles.iconContainer}>
            <BongoLogoMark />
          </div>
          <div className={styles.labelArea}>
            <BongoDbLogo className={styles.liamMigrationLogo} />
          </div>
        </>
      }
    />
  )
}
