import { MutableRefObject, PointerEvent, useEffect, useRef, useState } from 'react'
import type { InputVector } from '../game/types'
import { t } from '../i18n'
import { TouchAppIcon } from './Icons'

const RADIUS = 60

interface Props {
  input: MutableRefObject<InputVector>
  enabled: boolean
  showGuide: boolean
  onFirstInput: () => void
}

interface StickView { active: boolean; ox: number; oy: number; x: number; y: number }

export function Joystick({ input, enabled, showGuide, onFirstInput }: Props) {
  const [view, setView] = useState<StickView>({ active: false, ox: 0, oy: 0, x: 0, y: 0 })
  const pointerId = useRef<number | null>(null)
  const origin = useRef({ x: 0, y: 0 })
  const rafId = useRef<number | null>(null)
  const pendingView = useRef(view)

  const scheduleView = (next: StickView) => {
    pendingView.current = next
    if (rafId.current !== null) return
    rafId.current = window.requestAnimationFrame(() => {
      rafId.current = null
      setView(pendingView.current)
    })
  }

  useEffect(() => () => {
    if (rafId.current !== null) window.cancelAnimationFrame(rafId.current)
  }, [])

  const onDown = (ev: PointerEvent<HTMLDivElement>) => {
    if (!enabled || pointerId.current !== null) return
    ev.preventDefault()
    pointerId.current = ev.pointerId
    ev.currentTarget.setPointerCapture(ev.pointerId)
    const rect = ev.currentTarget.getBoundingClientRect()
    origin.current = { x: ev.clientX, y: ev.clientY }
    input.current = { x: 0, z: 0 }
    scheduleView({ active: true, ox: ev.clientX - rect.left, oy: ev.clientY - rect.top, x: 0, y: 0 })
    onFirstInput()
  }

  const onMove = (ev: PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== ev.pointerId) return
    ev.preventDefault()
    const dx = ev.clientX - origin.current.x
    const dy = ev.clientY - origin.current.y
    const length = Math.hypot(dx, dy)
    const scale = length > RADIUS ? RADIUS / length : 1
    const x = dx * scale
    const y = dy * scale
    input.current = { x: x / RADIUS, z: y / RADIUS }
    scheduleView({ ...pendingView.current, x, y })
  }

  const stop = (ev: PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== ev.pointerId) return
    pointerId.current = null
    input.current = { x: 0, z: 0 }
    scheduleView({ ...pendingView.current, active: false, x: 0, y: 0 })
    if (ev.currentTarget.hasPointerCapture(ev.pointerId)) ev.currentTarget.releasePointerCapture(ev.pointerId)
  }

  return (
    <div
      className="got-input-surface"
      aria-label={t('dragUp')}
      tabIndex={0}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={stop}
      onPointerCancel={stop}
    >
      {view.active && (
        <div className="got-stick" style={{ left: view.ox, top: view.oy }} aria-hidden="true">
          <span className="got-stick__ring" />
          <span className="got-stick__knob" style={{ transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px))` }} />
        </div>
      )}
      {showGuide && (
        <div className="got-gesture" aria-hidden="true">
          <div className="got-gesture__demo">
            <span className="got-gesture__trail" />
            <span className="got-gesture__finger"><TouchAppIcon size={68} /></span>
          </div>
          <b>{t('dragUp')}</b>
        </div>
      )}
    </div>
  )
}
