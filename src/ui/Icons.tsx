interface IconProps { size?: number }
const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true })

export function PauseIcon({ size = 24 }: IconProps) {
  return <svg {...base(size)}><path d="M8 5v14M16 5v14" /></svg>
}
export function SoundIcon({ size = 24 }: IconProps) {
  return <svg {...base(size)}><path d="M5 10v4h3l4 3V7L8 10H5Z" /><path d="M16 9c1.4 1.6 1.4 4.4 0 6M19 6c3 3.3 3 8.7 0 12" /></svg>
}
export function MutedIcon({ size = 24 }: IconProps) {
  return <svg {...base(size)}><path d="M5 10v4h3l4 3V7L8 10H5Z" /><path d="m16 10 5 5m0-5-5 5" /></svg>
}
export function ArrowIcon({ size = 24 }: IconProps) {
  return <svg {...base(size)}><path d="M5 12h14M14 7l5 5-5 5" /></svg>
}
export function TrainIcon({ size = 24 }: IconProps) {
  return <svg {...base(size)}><path d="M7 3h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M8 7h8v5H8zM8 21l2-3m6 3-2-3M8 15h.01M16 15h.01" /></svg>
}
export function BalanceIcon({ size = 24 }: IconProps) {
  return <svg {...base(size)}><path d="M12 4v16M5 9h14M7 9l-3 6h6L7 9Zm10 0-3 6h6l-3-6Z" /></svg>
}
export function CrownIcon({ size = 24 }: IconProps) {
  return <svg {...base(size)}><path d="m4 8 4 4 4-7 4 7 4-4-2 10H6L4 8Z" /><path d="M7 21h10" /></svg>
}
export function CloseIcon({ size = 24 }: IconProps) {
  return <svg {...base(size)}><path d="m6 6 12 12M18 6 6 18" /></svg>
}
export function CoinIcon({ size = 24 }: IconProps) {
  return <svg {...base(size)}><circle cx="12" cy="12" r="8" /><path d="M14.8 8.8c-.7-.7-1.6-1.1-2.8-1.1-1.5 0-2.6.8-2.6 1.9 0 2.8 5.2 1.2 5.2 4 0 1.2-1.1 2-2.8 2-1.2 0-2.3-.4-3-1.2M12 6.2v11.6" /></svg>
}
export function LockIcon({ size = 24 }: IconProps) {
  return <svg {...base(size)}><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7.5a4 4 0 0 1 8 0V10M12 14v2" /></svg>
}
export function CollectionIcon({ size = 24 }: IconProps) {
  return <svg {...base(size)}><path d="M5 7h14v12H5zM8 7V5h8v2" /><circle cx="9" cy="12" r="1.5" /><path d="M7.5 17c.4-2 2.6-3.1 4.5-3.1S16.1 15 16.5 17" /></svg>
}
export function ChevronIcon({ size = 24 }: IconProps) {
  return <svg {...base(size)}><path d="m15 5-7 7 7 7" /></svg>
}
