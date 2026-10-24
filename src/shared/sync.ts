/**
 * Maps between video time and the active recording clock (the clock used by
 * input events, which excludes paused time).
 *
 * Assumes the screen track's timestamps start at `mediaStartedAt` and run in
 * step with the active clock. That holds only if MediaRecorder timestamps skip
 * paused time. This is the sync risk called out in the architecture doc and
 * must be verified on a real pause/resume recording.
 */
export interface SyncAnchor {
  /** Epoch ms when the recording session began. */
  epoch: number
  /** Epoch ms of the screen track's first frame. */
  mediaStartedAt: number
}

export const videoSecondsToActiveMs = (videoSeconds: number, anchor: SyncAnchor): number =>
  anchor.mediaStartedAt - anchor.epoch + videoSeconds * 1000

export const activeMsToVideoSeconds = (activeMs: number, anchor: SyncAnchor): number =>
  (activeMs - (anchor.mediaStartedAt - anchor.epoch)) / 1000
