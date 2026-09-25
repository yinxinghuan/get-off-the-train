/** Frame-rate-independent smoothing. The AlterU build keeps the linear step. */
export function stepBlend(rate: number, dt: number, stable: boolean): number {
  if (!stable) return Math.min(1, rate * dt)
  const x = rate * dt
  return x >= 12 ? 1 : 1 - Math.exp(-x)
}

/**
 * Exact step of v' = steer*(target-v) - damp*v, plus the distance traveled
 * during that step. Same result at 60, 144, and 165 Hz.
 */
export function integrateSteer(current: number, target: number, steer: number, damp: number, dt: number) {
  const a = steer + damp
  const cruise = target * (steer / a)
  const decay = Math.exp(-a * dt)
  return {
    v: cruise + (current - cruise) * decay,
    dx: cruise * dt + (current - cruise) * (1 - decay) / a,
  }
}
