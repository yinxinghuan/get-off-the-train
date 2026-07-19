import { MutableRefObject, PointerEvent, useRef, useState } from 'react'
import type { InputVector } from '../game/types'
import { locale } from '../i18n'

const RADIUS = 54

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

  const onDown = (ev: PointerEvent<HTMLDivElement>) => {
    if (!enabled || pointerId.current !== null) return
    ev.preventDefault()
    pointerId.current = ev.pointerId
    ev.currentTarget.setPointerCapture(ev.pointerId)
    const rect = ev.currentTarget.getBoundingClientRect()
    origin.current = { x: ev.clientX, y: ev.clientY }
    input.current = { x: 0, z: 0 }
    setView({ active: true, ox: ev.clientX - rect.left, oy: ev.clientY - rect.top, x: 0, y: 0 })
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
    setView((current) => ({ ...current, x, y }))
  }

  const stop = (ev: PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== ev.pointerId) return
    pointerId.current = null
    input.current = { x: 0, z: 0 }
    setView((current) => ({ ...current, active: false, x: 0, y: 0 }))
    if (ev.currentTarget.hasPointerCapture(ev.pointerId)) ev.currentTarget.releasePointerCapture(ev.pointerId)
  }

  return (
    <div
      className="got-input-surface"
      aria-label={locale === 'zh' ? '任意位置拖动控制主角' : 'Drag anywhere to move'}
      tabIndex={0}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={stop}
      onPointerCancel={stop}
    >
      {view.active && (
        <div className="got-stick" style={{ left: view.ox, top: view.oy }} aria-hidden="true">
          <span className="got-stick__ring" />
          <span className="got-stick__cross got-stick__cross--x" />
          <span className="got-stick__cross got-stick__cross--y" />
          <span className="got-stick__knob" style={{ transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px))` }} />
        </div>
      )}
      {showGuide && (
        <div className="got-gesture" aria-hidden="true">
          <div className="got-gesture__track">
            <span className="got-gesture__trail" />
            <svg className="got-gesture__hand" viewBox="0 0 64 80" fill="none">
              <path d="M26 42V16c0-5 8-5 8 0v18-8c0-5 8-5 8 0v10-6c0-5 8-5 8 0v16c0 16-8 25-22 25-9 0-15-5-19-13L4 47c-2-5 5-9 8-4l7 9V31c0-5 7-5 7 0v11Z" />
              <path d="M18 12 26 4l8 8" />
            </svg>
          </div>
          <b>{locale === 'zh' ? '任意位置向上拖动' : 'DRAG UP ANYWHERE'}</b>
        </div>
      )}
    </div>
  )
}
