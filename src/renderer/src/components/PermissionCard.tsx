import type { AppPlatform, PermissionKind, PermissionState } from '@shared/platform'
import { PERMISSION_META, permissionGuidance } from '@renderer/lib/permissions'
import { PermissionIcon } from './PermissionIcon'
import { StatusPill } from './StatusPill'

interface PermissionCardProps {
  permission: PermissionState
  platform: AppPlatform | undefined
  pending: boolean
  onRequest: (kind: PermissionKind) => void
}

export function PermissionCard({
  permission,
  platform,
  pending,
  onRequest
}: PermissionCardProps): React.JSX.Element {
  const meta = PERMISSION_META[permission.kind]
  const granted = permission.status === 'granted'
  const unavailable = permission.status === 'unavailable'
  const steps = granted ? [] : permissionGuidance(permission.kind, platform)
  const actionLabel = pending
    ? 'Opening…'
    : permission.status === 'not-determined'
      ? 'Grant access'
      : 'Open settings'

  return (
    <article className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
      <div className="flex items-start gap-4">
        <div
          className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl border ${
            granted
              ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
              : 'border-white/8 bg-white/[0.04] text-zinc-300'
          }`}
        >
          <PermissionIcon kind={permission.kind} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-100">{meta.title}</h3>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
              {permission.required ? 'Required' : 'Optional'}
            </span>
            <StatusPill status={permission.status} />
          </div>

          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{meta.description}</p>

          {steps.length > 0 ? (
            <ol className="mt-3 space-y-1.5 rounded-xl border border-white/5 bg-black/20 p-3">
              {steps.map((step, index) => (
                <li key={step} className="flex gap-2 text-[11px] leading-relaxed text-zinc-400">
                  <span className="mt-px grid size-4 shrink-0 place-items-center rounded-full bg-white/5 text-[9px] font-medium text-zinc-500">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>

        {!granted && !unavailable ? (
          <button
            type="button"
            onClick={() => onRequest(permission.kind)}
            disabled={pending}
            aria-busy={pending}
            className="shrink-0 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </article>
  )
}
