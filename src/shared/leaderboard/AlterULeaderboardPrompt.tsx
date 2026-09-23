// Shown only on non-Crazy Games builds when the player is outside Aigram.
// Kept in its own module so the Crazy Games bundle can drop the download link.
import { CrownIcon } from '../../ui/Icons'
import { t } from '../../i18n'

export function AlterULeaderboardPrompt() {
  return (
    <div className="got-lb__state">
      <CrownIcon size={38} />
      <b>{t('openAlterU')}</b>
      <a href="https://alteru.app" target="_blank" rel="noopener noreferrer">{t('getAlterU')}</a>
    </div>
  )
}
