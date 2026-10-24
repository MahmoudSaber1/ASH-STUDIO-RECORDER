import type { PermissionKind } from '@shared/platform'

export function PermissionIcon({ kind }: { kind: PermissionKind }): React.JSX.Element {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
      {kind === 'screen' ? (
        <g {...common}>
          <rect x="3" y="4" width="18" height="12.5" rx="2" />
          <path d="M9 20h6M12 16.5V20" />
        </g>
      ) : null}
      {kind === 'accessibility' ? (
        <g {...common}>
          <circle cx="12" cy="5" r="2" />
          <path d="M5 9h14M12 9v5M8.5 20l3.5-6 3.5 6" />
        </g>
      ) : null}
      {kind === 'camera' ? (
        <g {...common}>
          <rect x="3" y="7" width="12.5" height="10" rx="2.5" />
          <path d="m15.5 11 5-2.5v7L15.5 13" />
        </g>
      ) : null}
      {kind === 'microphone' ? (
        <g {...common}>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M6 11.5a6 6 0 0 0 12 0M12 17.5V21M9 21h6" />
        </g>
      ) : null}
    </svg>
  )
}
