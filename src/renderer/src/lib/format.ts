const pad = (value: number): string => String(value).padStart(2, '0')

export const formatDuration = (milliseconds: number): string => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

/** Timecode with centiseconds, for transport readouts: 01:02.45 */
export const formatTimecode = (milliseconds: number): string => {
  const safe = Math.max(0, milliseconds)
  const totalCentis = Math.floor(safe / 10)
  const centis = totalCentis % 100
  const totalSeconds = Math.floor(totalCentis / 100)
  return `${formatDuration(totalSeconds * 1000)}.${pad(centis)}`
}
