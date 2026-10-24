import type { AspectPreset } from './project'

export const RESOLUTION_HEIGHTS = {
  '720p': 720,
  '1080p': 1080,
  '1440p': 1440,
  '4K': 2160
} as const

export type ResolutionPreset = keyof typeof RESOLUTION_HEIGHTS

const EVEN = (value: number): number => Math.max(2, Math.round(value / 2) * 2)

const ratioOf = (aspect: AspectPreset, sourceAspect: number): number => {
  switch (aspect) {
    case '16:9':
      return 16 / 9
    case '9:16':
      return 9 / 16
    case '1:1':
      return 1
    case '4:3':
      return 4 / 3
    default:
      return sourceAspect
  }
}

/**
 * Output frame size. `baseHeight` is the long side, so 1080p means 1080 px on
 * the long edge for every aspect preset. Dimensions are even for H.264.
 */
export const outputSize = (
  aspect: AspectPreset,
  baseHeight: number,
  sourceAspect: number
): { width: number; height: number } => {
  const ratio = ratioOf(aspect, sourceAspect)

  if (ratio >= 1) {
    return { width: EVEN(baseHeight * ratio), height: EVEN(baseHeight) }
  }

  return { width: EVEN(baseHeight), height: EVEN(baseHeight / ratio) }
}
