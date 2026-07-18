import { useEffect, useState } from 'react'
import { isInAigram, openAigramProfile } from '../runtime'
import type { LeaderboardEntry } from './useGameScore'
import { CrownIcon, CloseIcon } from '../../ui/Icons'
import { t } from '../../i18n'

interface Props {
  fetchEntries: () => Promise<LeaderboardEntry[]>
  onClose: () => void
}

function Avatar({ entry }: { entry: LeaderboardEntry }) {
  return (
    <span className="got-lb__avatar" aria-hidden="true">
      {entry.avatar_url
        ? <img src={entry.avatar_url} alt="" draggable={false} />
        : <span>{(entry.name || '?').slice(0, 1).toUpperCase()}</span>}
    </span>
  )
}

function RankRow({ entry, index }: { entry: LeaderboardEntry; index: number }) {
  const content = (
    <>
      <span className={`got-lb__rank${index < 3 ? ` got-lb__rank--${index + 1}` : ''}`}>{index + 1}</span>
      {entry.isMe ? <span className="got-lb__you">{t('you')}</span> : <Avatar entry={entry} />}
      <span className="got-lb__name">{entry.isMe ? t('yourRun') : entry.name || '·'}</span>
      <strong className="got-lb__score">{Math.round(entry.score).toLocaleString()}</strong>
    </>
  )
  if (entry.isMe) return <div className="got-lb__row got-lb__row--me">{content}</div>
  return (
    <button
      type="button"
      className="got-lb__row"
      onClick={(ev) => { ev.stopPropagation(); if (isInAigram) openAigramProfile(entry.user_id) }}
      disabled={!isInAigram}
      aria-label={`${t('openProfile')} ${entry.name || ''}`}
    >{content}</button>
  )
}

export function Leaderboard({ fetchEntries, onClose }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchEntries().then((rows) => { if (alive) setEntries(rows) }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [fetchEntries])

  return (
    <div className="got-lb" role="dialog" aria-modal="true" aria-label={t('leaderboard')} onClick={(ev) => { if (ev.target === ev.currentTarget) onClose() }}>
      <section className="got-lb__panel">
        <header className="got-lb__header">
          <CrownIcon size={28} />
          <div><h2>{t('leaderboard')}</h2><span>{t('rankRule')}</span></div>
          <button type="button" className="got-lb__close" onClick={onClose} aria-label={t('close')}><CloseIcon /></button>
        </header>
        <div className="got-lb__list">
          {loading && <div className="got-lb__state"><span className="got-lb__spinner" />{t('loading')}</div>}
          {!loading && !isInAigram && <div className="got-lb__state"><CrownIcon size={38} /><b>{t('openAlterU')}</b><a href="https://alteru.app/" target="_blank" rel="noreferrer">{t('getAlterU')}</a></div>}
          {!loading && isInAigram && entries.length === 0 && <div className="got-lb__state"><CrownIcon size={38} /><b>{t('emptyRank')}</b></div>}
          {!loading && isInAigram && entries.map((entry, index) => <RankRow key={entry.user_id} entry={entry} index={index} />)}
        </div>
      </section>
    </div>
  )
}
