import { isCrazyGamesBuild } from '../shared/runtime/deployTarget'

let ctx: AudioContext | null = null
let muted = false
let lastBump = 0

const MUTE_KEY = 'get-off-the-train.cg.muted'

function readGuestMuted() {
  if (!isCrazyGamesBuild) return false
  try { return alteruLocalStorage.getItem(MUTE_KEY) === '1' } catch { return false }
}

muted = readGuestMuted()

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

// Guest music and layered effects. Original synthesis only — see doc/audio.md.
// Stays silent until the first gesture (`armed`).
let armed = false
let master: GainNode | null = null
let sfxBus: GainNode | null = null
let musicBus: GainNode | null = null
let scheduler: number | null = null
let nextNoteAt = 0
let stepIndex = 0
let pad: OscillatorNode | null = null

const SFX_BUS = 0.62
const MUSIC_BUS = 0.16
const BEAT = 60 / 92 / 2

function ensureGuest(): AudioContext | null {
  if (!armed) return null
  try {
    const ac = context()
    if (!master) {
      master = ac.createGain()
      master.gain.value = muted ? 0 : 1
      const comp = ac.createDynamicsCompressor()
      comp.threshold.value = -14
      comp.knee.value = 10
      comp.ratio.value = 3
      comp.attack.value = 0.006
      comp.release.value = 0.16
      master.connect(comp)
      comp.connect(ac.destination)
      sfxBus = ac.createGain()
      sfxBus.gain.value = SFX_BUS
      sfxBus.connect(master)
      musicBus = ac.createGain()
      musicBus.gain.value = MUSIC_BUS
      musicBus.connect(master)
    }
    return ac
  } catch {
    return null
  }
}

function guestAc() {
  if (muted || !armed) return null
  return ensureGuest()
}

function voice(freq: number, dur: number, type: OscillatorType, gain: number, slide?: number, delay = 0) {
  const ac = guestAc()
  if (!ac || !sfxBus) return
  const start = ac.currentTime + delay
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  const filter = ac.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(2200, start)
  osc.type = type
  osc.frequency.setValueAtTime(Math.max(1, freq), start)
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slide), start + dur)
  amp.gain.setValueAtTime(0.0001, start)
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.01)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(filter)
  filter.connect(amp)
  amp.connect(sfxBus)
  osc.start(start)
  osc.stop(start + dur + 0.02)
}

function noise(dur: number, gain: number, freq: number, type: BiquadFilterType, delay = 0) {
  const ac = guestAc()
  if (!ac || !sfxBus) return
  const start = ac.currentTime + delay
  const n = Math.max(1, Math.floor(ac.sampleRate * dur))
  const buf = ac.createBuffer(1, n, ac.sampleRate)
  const data = buf.getChannelData(0)
  let prev = 0
  for (let i = 0; i < n; i++) {
    prev = prev * 0.94 + (Math.random() * 2 - 1) * 0.06
    data[i] = prev * (1 - i / n)
  }
  const src = ac.createBufferSource()
  src.buffer = buf
  const filter = ac.createBiquadFilter()
  filter.type = type
  filter.frequency.value = freq
  const amp = ac.createGain()
  amp.gain.value = gain
  src.connect(filter)
  filter.connect(amp)
  amp.connect(sfxBus)
  src.start(start)
}

function guestTap() { voice(520, 0.05, 'triangle', 0.14, 340); noise(0.04, 0.05, 1400, 'highpass') }
function guestBump() {
  const now = performance.now()
  if (now - lastBump < 80) return
  lastBump = now
  voice(140, 0.07, 'sine', 0.14, 70)
  noise(0.06, 0.07, 280, 'lowpass')
}
function guestSeat() { voice(280, 0.08, 'triangle', 0.1, 180); voice(190, 0.1, 'sine', 0.08, 140, 0.12) }
function guestBoard() { noise(0.09, 0.06, 900, 'bandpass'); voice(360, 0.08, 'sine', 0.08, 520); voice(540, 0.07, 'triangle', 0.06, 420, 0.08) }
function guestWarn() { voice(440, 0.09, 'square', 0.08, 320); voice(440, 0.09, 'triangle', 0.07, 300, 0.16); noise(0.05, 0.03, 1800, 'highpass') }
function guestSway() { voice(90, 0.22, 'sine', 0.14, 54); noise(0.2, 0.07, 180, 'lowpass') }
function guestFall() { voice(110, 0.18, 'triangle', 0.14, 60); noise(0.16, 0.08, 240, 'lowpass') }
function guestTrip() { noise(0.12, 0.07, 700, 'bandpass'); voice(180, 0.12, 'triangle', 0.1, 90); voice(70, 0.2, 'sine', 0.12, 48, 0.1) }
function guestWin() { [523, 659, 784].forEach((f, i) => voice(f, 0.14, 'triangle', 0.12, undefined, i * 0.08)) }
function guestCoins() { voice(880, 0.07, 'triangle', 0.12, 1040, 0.02); voice(1310, 0.08, 'sine', 0.1, undefined, 0.1) }
function guestEquip() { voice(620, 0.05, 'triangle', 0.12, 480); noise(0.03, 0.04, 1600, 'highpass') }
function guestLose() {
  voice(220, 0.16, 'triangle', 0.12, 140)
  voice(110, 0.28, 'sine', 0.12, 70, 0.1)
  noise(0.3, 0.06, 200, 'lowpass', 0.12)
}
function guestHero() {
  ;[440, 554, 659].forEach((f, i) => voice(f, 0.12, 'triangle', 0.12, undefined, i * 0.07))
}

function musicNote(ac: AudioContext, time: number, freq: number, dur: number, gain: number, type: OscillatorType) {
  if (!musicBus) return
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  const filter = ac.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 1400
  osc.type = type
  osc.frequency.setValueAtTime(freq, time)
  amp.gain.setValueAtTime(0.0001, time)
  amp.gain.exponentialRampToValueAtTime(gain, time + 0.02)
  amp.gain.exponentialRampToValueAtTime(0.0001, time + dur)
  osc.connect(filter)
  filter.connect(amp)
  amp.connect(musicBus)
  osc.start(time)
  osc.stop(time + dur + 0.02)
}

function clack(ac: AudioContext, time: number, gain: number) {
  if (!musicBus) return
  const n = Math.floor(ac.sampleRate * 0.05)
  const buf = ac.createBuffer(1, n, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2
  const src = ac.createBufferSource()
  src.buffer = buf
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 220
  filter.Q.value = 0.8
  const amp = ac.createGain()
  amp.gain.value = gain
  src.connect(filter)
  filter.connect(amp)
  amp.connect(musicBus)
  src.start(time)
}

const MOTIF = [220, 262, 294, 330, 294, 247, 220, 196]

function stopMusic() {
  if (scheduler != null) { window.clearInterval(scheduler); scheduler = null }
  if (pad) { try { pad.stop() } catch { /* already stopped */ } pad = null }
}

function startMusic() {
  const ac = ensureGuest()
  if (!ac || !musicBus || muted || scheduler != null) return
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  const filter = ac.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 280
  osc.type = 'sine'
  osc.frequency.value = 110
  amp.gain.value = 0.04
  osc.connect(filter)
  filter.connect(amp)
  amp.connect(musicBus)
  osc.start()
  pad = osc
  nextNoteAt = ac.currentTime + 0.05
  stepIndex = 0
  const tick = () => {
    const live = ensureGuest()
    if (!live || muted) return
    const horizon = live.currentTime + 0.28
    while (nextNoteAt < horizon) {
      const eighth = stepIndex % 8
      clack(live, nextNoteAt, eighth % 2 === 0 ? 0.09 : 0.035)
      if (eighth % 4 === 0) musicNote(live, nextNoteAt, eighth % 8 === 0 ? 55 : 82, 0.22, 0.05, 'sine')
      if (eighth % 2 === 0) musicNote(live, nextNoteAt, MOTIF[(stepIndex / 2) % MOTIF.length], 0.28, 0.045, 'triangle')
      nextNoteAt += BEAT
      stepIndex++
    }
  }
  tick()
  scheduler = window.setInterval(tick, 80)
}

function guestUnlock() {
  armed = true
  ensureGuest()
  if (!muted) startMusic()
}

function guestToggle() {
  muted = !muted
  try { alteruLocalStorage.setItem(MUTE_KEY, muted ? '1' : '0') } catch { /* private mode */ }
  if (master && ctx) master.gain.setValueAtTime(muted ? 0 : 1, ctx.currentTime)
  if (muted) stopMusic()
  else if (armed) startMusic()
  return muted
}

const host = {
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
  lose: () => {
    tone(210, 0.14, 'square', 0.055, 130)
    tone(118, 0.28, 'sawtooth', 0.07, 72, 0.12)
    tone(74, 0.72, 'triangle', 0.035, 48, 0.56)
  },
}

const guest = {
  unlock: guestUnlock,
  toggle: guestToggle,
  isMuted: () => muted,
  tap: guestTap,
  bump: guestBump,
  seatRise: guestSeat,
  boarding: guestBoard,
  warn: guestWarn,
  sway: guestSway,
  fall: guestFall,
  trip: guestTrip,
  win: guestWin,
  coins: guestCoins,
  unlockHero: guestHero,
  equip: guestEquip,
  lose: guestLose,
}

export const sound = isCrazyGamesBuild ? guest : host
