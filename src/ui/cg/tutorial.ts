// First-run guest tutorial. The AlterU host build never reads this key.
import { useEffect, useRef, useState } from 'react'
import type { HudState, Phase } from '../../game/types'
import { isCrazyGamesBuild } from '../../shared/runtime/deployTarget'

const DONE = 'get-off-the-train.cg.tutorial'

export type CoachStep = 'move' | 'sway' | 'fall' | 'door'

export function tutorialDone(): boolean {
  try { return alteruLocalStorage.getItem(DONE) === '1' }
  catch { return false }
}

export function markTutorialDone(): void {
  try { alteruLocalStorage.setItem(DONE, '1') } catch { /* private mode */ }
}

export function clearTutorial(): void {
  try { alteruLocalStorage.removeItem(DONE) } catch { /* private mode */ }
}

export function useCoach(hud: HudState, phase: Phase) {
  const enabled = isCrazyGamesBuild
  const [step, setStep] = useState<CoachStep | null>(() => (enabled && !tutorialDone() ? 'move' : null))
  const sawSway = useRef(false)

  useEffect(() => {
    if (step !== 'move') return
    if (hud.distance < 11.15) setStep('sway')
  }, [step, hud.distance])

  useEffect(() => {
    if (step !== 'sway') return
    if (hud.falls > 0) { setStep('fall'); return }
    if (hud.swayWarning) sawSway.current = true
    if (sawSway.current && !hud.swayWarning) setStep('fall')
  }, [step, hud.swayWarning, hud.falls])

  const fallAnchor = useRef<number | null>(null)
  useEffect(() => {
    if (step !== 'fall') { fallAnchor.current = null; return }
    if (fallAnchor.current == null) fallAnchor.current = hud.distance
    if (fallAnchor.current - hud.distance > 0.65) setStep('door')
  }, [step, hud.distance])

  useEffect(() => {
    if (step !== 'fall') return
    const id = window.setTimeout(() => setStep((curr) => (curr === 'fall' ? 'door' : curr)), 6500)
    return () => window.clearTimeout(id)
  }, [step])

  useEffect(() => {
    if (step && phase === 'level-clear') {
      markTutorialDone()
      setStep(null)
    }
  }, [phase, step])

  const skip = () => {
    markTutorialDone()
    setStep(null)
  }
  const advance = () => {
    if (step === 'fall') setStep('door')
    else if (step === 'door') skip()
  }
  const replay = () => {
    clearTutorial()
    sawSway.current = false
    setStep('move')
  }
  return { step: enabled ? step : null, skip, advance, replay }
}
