import { useId } from 'react'

export function Logo({ className = 'size-7' }: { className?: string }): React.JSX.Element {
  const gradientId = useId()

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gradientId})`} />
      <circle cx="16" cy="16" r="6.5" fill="none" stroke="white" strokeWidth="2.5" />
      <circle cx="16" cy="16" r="2" fill="white" />
    </svg>
  )
}
