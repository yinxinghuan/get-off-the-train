import { useEffect, useRef, type MutableRefObject } from 'react'
import type { InputVector, Phase } from '../../game/types'
import type { CoachStep } from './tutorial'
import { sound } from '../../audio/sound'
import { isCrazyGamesBuild } from '../../shared/runtime/deployTarget'

interface Api {
  phase: Phase
  showGuide: boolean
  showBoard: boolean
  showCollection: boolean
  coach: CoachStep | null
  beginFromInput: () => void
  pause: () => void
  resume: () => void
  nextLevel: () => void
  restartRun: () => void
  toggleMute: () => void
  advanceCoach: () => void
}

const MOVE_KEYS = ['a', 'd', 'w', 's', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown']

/** Crazy Games keyboard map. Not installed on the AlterU host build. */
export function useCgKeys(input: MutableRefObject<InputVector>, api: Api) {
  const ref = useRef(api)
  ref.current = api
  useEffect(() => {
    if (!isCrazyGamesBuild) return
    const down = (ev: KeyboardEvent) => {
      const key = ev.key.toLowerCase()
      if (ev.key === 'Escape') return
      if (key === 'p' && !ev.repeat) {
        ev.preventDefault()
        sound.unlock()
        const live = ref.current
        if (live.phase === 'paused') live.resume()
        else live.pause()
        return
      }
      if (key === 'm' && !ev.repeat) {
        ev.preventDefault()
        sound.unlock()
        ref.current.toggleMute()
        return
      }
      if ((key === ' ' || key === 'enter') && !ev.repeat) {
        ev.preventDefault()
        sound.unlock()
        const live = ref.current
        if (live.showBoard || live.showCollection) return
        if (live.phase === 'paused') { live.resume(); return }
        if (live.phase === 'level-clear') { live.nextLevel(); return }
        if (live.phase === 'game-over') { live.restartRun(); return }
        if (live.coach === 'fall' || live.coach === 'door') { live.advanceCoach(); return }
        return
      }
      if (!MOVE_KEYS.includes(key)) return
      ev.preventDefault()
      sound.unlock()
      ref.current.beginFromInput()
      if (key === 'a' || key === 'arrowleft') input.current.x = -1
      if (key === 'd' || key === 'arrowright') input.current.x = 1
      if (key === 'w' || key === 'arrowup') input.current.z = -1
      if (key === 's' || key === 'arrowdown') input.current.z = 1
    }
    const up = (ev: KeyboardEvent) => {
      const key = ev.key.toLowerCase()
      if ((key === 'a' || key === 'arrowleft') && input.current.x < 0) input.current.x = 0
      if ((key === 'd' || key === 'arrowright') && input.current.x > 0) input.current.x = 0
      if ((key === 'w' || key === 'arrowup') && input.current.z < 0) input.current.z = 0
      if ((key === 's' || key === 'arrowdown') && input.current.z > 0) input.current.z = 0
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [input])
}
