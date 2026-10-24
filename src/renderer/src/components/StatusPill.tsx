import type { PermissionStatus } from '@shared/platform'
import { formatPermissionStatus } from '@renderer/lib/permissions'

const STATUS_STYLES: Record<PermissionStatus, { pill: string; dot: string }> = {
  granted: {
    pill: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
    dot: 'bg-emerald-400'
  },
  denied: {
    pill: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
    dot: 'bg-rose-400'
  },
  restricted: {
    pill: 'border-orange-400/25 bg-orange-400/10 text-orange-200',
    dot: 'bg-orange-400'
  },
  'not-determined': {
    pill: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
    dot: 'bg-amber-400'
  },
  unknown: {
    pill: 'border-zinc-400/25 bg-zinc-400/10 text-zinc-300',
    dot: 'bg-zinc-400'
  },
  unavailable: {
    pill: 'border-zinc-500/25 bg-zinc-500/10 text-zinc-400',
    dot: 'bg-zinc-500'
  }
}

export function StatusPill({ status }: { status: PermissionStatus }): React.JSX.Element {
  const styles = STATUS_STYLES[status]

  return (
    <span
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${styles.pill}`}
    >
      <span className={`size-1.5 rounded-full ${styles.dot}`} />
      {formatPermissionStatus(status)}
    </span>
  )
}
