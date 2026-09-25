import { isCrazyGamesBuild } from '../shared/runtime/deployTarget'

let ctx: AudioContext | null = null
let muted = false
let lastBump = 0

const MUTE_KEY = 'get-off-the-train.cg.muted'
const VOL_KEY = 'get-off-the-train.cg.volume'

function readGuestMuted() {
  if (!isCrazyGamesBuild) return false
  try { return alteruLocalStorage.getItem(MUTE_KEY) === '1' } catch { return false }
}

function readGuestVolume() {
  if (!isCrazyGamesBuild) return 1
  try {
    const raw = alteruLocalStorage.getItem(VOL_KEY)
    if (raw == null) return 0.8
    const n = Number(raw)
    return Number.isFinite(n) ? Math.max(0.15, Math.min(1, n)) : 0.8
  } catch { return 0.8 }
}

muted = readGuestMuted()
let volume = readGuestVolume()

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

// Guest bed is a recorded loop. Effects stay layered. Silent until the first gesture.
let armed = false
let master: GainNode | null = null
let sfxBus: GainNode | null = null
let musicBus: GainNode | null = null

function ensureGuest(): AudioContext | null {
  if (!armed) return null
  try {
    const ac = context()
    if (!master) {
      master = ac.createGain()
      master.gain.value = muted ? 0 : volume
      const comp = ac.createDynamicsCompressor()
      comp.threshold.value = -14
      comp.knee.value = 10
      comp.ratio.value = 3
      comp.attack.value = 0.006
      comp.release.value = 0.16
      master.connect(comp)
      comp.connect(ac.destination)
      sfxBus = ac.createGain()
      sfxBus.gain.value = 0.7
      sfxBus.connect(master)
      musicBus = ac.createGain()
      musicBus.gain.value = 0.46
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
function guestWin() { playSting('clear') }
function guestCoins() { voice(880, 0.07, 'triangle', 0.12, 1040, 0.02); voice(1310, 0.08, 'sine', 0.1, undefined, 0.1) }
function guestEquip() { voice(620, 0.05, 'triangle', 0.12, 480); noise(0.03, 0.04, 1600, 'highpass') }
function guestLose() { playSting('miss') }
function guestHero() {
  ;[440, 554, 659].forEach((f, i) => voice(f, 0.12, 'triangle', 0.12, undefined, i * 0.07))
}

type StingKind = 'clear' | 'miss'
type Bed = 'loop' | 'sting'

let want: Bed = 'loop'
let pendingSting: StingKind = 'miss'
let loopSrc: AudioBufferSourceNode | null = null
let stingSrc: AudioBufferSourceNode | null = null
let tracks: { loop: AudioBuffer; clear: AudioBuffer; miss: AudioBuffer } | null = null
let loading: Promise<void> | null = null

function applyBuses() {
  if (master) master.gain.setValueAtTime(muted ? 0 : volume, ctx?.currentTime ?? 0)
  if (musicBus) musicBus.gain.value = 0.46
  if (sfxBus) sfxBus.gain.value = 0.7
}

function stopNode(node: AudioBufferSourceNode | null) {
  if (!node) return
  try { node.stop() } catch { /* already stopped */ }
}

function stopLoop() {
  stopNode(loopSrc)
  loopSrc = null
}

function stopSting() {
  stopNode(stingSrc)
  stingSrc = null
}

function startLoop() {
  const ac = ensureGuest()
  if (!ac || !musicBus || muted || !tracks || loopSrc || want !== 'loop') return
  const src = ac.createBufferSource()
  src.buffer = tracks.loop
  src.loop = true
  src.connect(musicBus)
  src.start()
  loopSrc = src
  src.onended = () => { if (loopSrc === src) loopSrc = null }
}

function startSting() {
  const ac = ensureGuest()
  if (!ac || !musicBus || muted || !tracks || want !== 'sting') return
  stopSting()
  const src = ac.createBufferSource()
  src.buffer = pendingSting === 'clear' ? tracks.clear : tracks.miss
  src.connect(musicBus)
  src.start()
  stingSrc = src
  src.onended = () => { if (stingSrc === src) stingSrc = null }
}

function loadTracks() {
  if (tracks || loading) return loading ?? Promise.resolve()
  loading = (async () => {
    if (import.meta.env.MODE !== 'crazygames') return
    const ac = ensureGuest()
    if (!ac) return
    const mod = await import('./cgTracks')
    const decode = async (url: string) => {
      const res = await fetch(url)
      const raw = await res.arrayBuffer()
      return ac.decodeAudioData(raw.slice(0))
    }
    tracks = {
      loop: await decode(mod.loopUrl),
      clear: await decode(mod.clearUrl),
      miss: await decode(mod.missUrl),
    }
    if (want === 'loop') startLoop()
    else startSting()
  })().catch(() => { loading = null })
  return loading
}

function playSting(kind: StingKind) {
  want = 'sting'
  pendingSting = kind
  stopLoop()
  if (!tracks) { loadTracks(); return }
  startSting()
}

function resumeLoop() {
  want = 'loop'
  stopSting()
  if (muted) return
  if (!tracks) { loadTracks(); return }
  startLoop()
}

function guestUnlock() {
  armed = true
  ensureGuest()
  applyBuses()
  if (want === 'loop' && !muted) loadTracks()
}

function guestToggle() {
  muted = !muted
  try { alteruLocalStorage.setItem(MUTE_KEY, muted ? '1' : '0') } catch { /* private mode */ }
  applyBuses()
  if (muted) { stopLoop(); stopSting() }
  else if (armed && want === 'loop') { if (!tracks) loadTracks(); else startLoop() }
  else if (armed && want === 'sting') { if (!tracks) loadTracks(); else startSting() }
  return muted
}

function guestNudgeVolume(delta: number) {
  volume = Math.max(0.15, Math.min(1, Math.round((volume + delta) * 100) / 100))
  try { alteruLocalStorage.setItem(VOL_KEY, String(volume)) } catch { /* private mode */ }
  applyBuses()
  return volume
}

const host = {
  unlock: () => { if (!muted) context() },
  toggle: () => (muted = !muted),
  isMuted: () => muted,
  resumeLoop: () => {},
  nudgeVolume: (_delta: number) => 1,
  getVolume: () => 1,
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
  resumeLoop,
  nudgeVolume: guestNudgeVolume,
  getVolume: () => volume,
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
