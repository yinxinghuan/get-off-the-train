let ctx: AudioContext | null = null
let muted = false
let lastBump = 0

function context() {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function tone(freq: number, duration: number, type: OscillatorType, volume: number, endFreq?: number, delay = 0) {
  if (muted) return
  try {
    const ac = context()
    const start = ac.currentTime + delay
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, start)
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    osc.connect(gain).connect(ac.destination)
    osc.start(start)
    osc.stop(start + duration + 0.02)
  } catch { /* audio is optional */ }
}

export const sound = {
  unlock: () => { if (!muted) context() },
  toggle: () => (muted = !muted),
  isMuted: () => muted,
  tap: () => tone(220, 0.045, 'triangle', 0.035),
  bump: () => {
    const now = performance.now()
    if (now - lastBump < 80) return
    lastBump = now
    tone(120 + Math.random() * 30, 0.055, 'square', 0.035, 90)
  },
  seatRise: () => {
    tone(260, 0.07, 'triangle', 0.028, 190)
    tone(180, 0.09, 'triangle', 0.032, 130, 0.14)
  },
  boarding: () => { tone(360, 0.06, 'sine', 0.026, 480); tone(540, 0.07, 'sine', 0.024, 430, 0.09) },
  warn: () => { tone(420, 0.09, 'square', 0.04, 310); tone(420, 0.09, 'square', 0.04, 310, 0.18) },
  sway: () => tone(120, 0.18, 'triangle', 0.075, 75),
  fall: () => tone(110, 0.22, 'sawtooth', 0.065, 62),
  trip: () => { tone(170, 0.12, 'triangle', 0.05, 120); tone(82, 0.18, 'sawtooth', 0.06, 54, 0.17) },
  win: () => { [520, 660, 820].forEach((f, i) => tone(f, 0.14, 'sine', 0.055, undefined, i * 0.09)) },
  coins: () => { tone(720, 0.08, 'sine', 0.045, 820, 0.18); tone(920, 0.08, 'sine', 0.045, undefined, 0.245) },
  unlockHero: () => { [440, 660, 880].forEach((f, i) => tone(f, 0.11, 'triangle', 0.06, undefined, i * 0.085)) },
  equip: () => tone(520, 0.055, 'triangle', 0.035),
  lose: () => tone(180, 0.42, 'square', 0.065, 95),
}
