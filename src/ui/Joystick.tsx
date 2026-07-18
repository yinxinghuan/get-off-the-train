import { MutableRefObject, useRef, useState } from 'react'
import type { InputVector } from '../game/types'

export function Joystick({ input }: { input: MutableRefObject<InputVector> }) {
  const baseRef = useRef<HTMLDivElement>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const activeId = useRef<number | null>(null)

  const update = (clientX: number, clientY: number) => {
    const rect = baseRef.current!.getBoundingClientRect()
    let x = clientX - (rect.left + rect.width / 2)
    let y = clientY - (rect.top + rect.height / 2)
    const max = rect.width * 0.31
    const d = Math.hypot(x, y)
    if (d > max) { x = x / d * max; y = y / d * max }
    setKnob({ x, y })
    input.current = { x: x / max, z: y / max }
  }
  const stop = () => { activeId.current = null; setKnob({ x: 0, y: 0 }); input.current = { x: 0, z: 0 } }

  return (
    <div
      ref={baseRef}
      className="got-stick"
      aria-label="移动摇杆"
      onPointerDown={(ev) => { activeId.current = ev.pointerId; ev.currentTarget.setPointerCapture(ev.pointerId); update(ev.clientX, ev.clientY) }}
      onPointerMove={(ev) => { if (activeId.current === ev.pointerId) update(ev.clientX, ev.clientY) }}
      onPointerUp={stop}
      onPointerCancel={stop}
    >
      <span className="got-stick__cross got-stick__cross--x" />
      <span className="got-stick__cross got-stick__cross--y" />
      <span className="got-stick__knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  )
}
