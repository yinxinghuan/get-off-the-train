// Landscape framing for the Crazy Games guest build only.
// The AlterU host build never takes this path (isCrazyGamesBuild is false).
import { useEffect, useState } from 'react'
import { isCrazyGamesBuild } from '../../shared/runtime/deployTarget'

/** Guest build in a landscape iframe (Crazy Games desktop, including 800×450). */
export function isGuestDesk(w = window.innerWidth, h = window.innerHeight): boolean {
  if (!isCrazyGamesBuild) return false
  return w > h && w >= 700 && h >= 360
}

export function useGuestDesk(): boolean {
  const [desk, setDesk] = useState(() => isGuestDesk())
  useEffect(() => {
    if (!isCrazyGamesBuild) return
    const update = () => setDesk(isGuestDesk())
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return desk
}
