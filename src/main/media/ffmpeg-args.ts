import type { ExportSettings } from '@shared/export'

/** Microphone input with its absolute path resolved, ready for FFmpeg. */
export interface ExportAudio {
  path: string
  seekSeconds: number
  delaySeconds: number
  volume: number
  fadeInSeconds: number
  fadeOutSeconds: number
}

/** Export settings with the audio path resolved, plus the platform for the encoder choice. */
export type ExportRequest = Omit<ExportSettings, 'audio' | 'projectKey'> & {
  audio: ExportAudio | null
  platform: NodeJS.Platform
}

const hardwareEncoder = (platform: NodeJS.Platform): string | null => {
  if (platform === 'darwin') return 'h264_videotoolbox'
  if (platform === 'win32') return 'h264_nvenc'
  return null
}

/** FFmpeg arguments for the chosen output format. Exposed for tests. */
export const buildFfmpegArgs = (request: ExportRequest, outputPath: string): string[] => {
  const { format, width, height, fps, durationSeconds, audio } = request
  const args = [
    '-y',
    '-v',
    'error',
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgba',
    '-s',
    `${width}x${height}`,
    '-r',
    String(fps),
    '-i',
    'pipe:0'
  ]

  if (audio && format !== 'gif') {
    if (audio.delaySeconds > 0) {
      args.push('-itsoffset', audio.delaySeconds.toFixed(3))
    }
    args.push('-ss', Math.max(0, audio.seekSeconds).toFixed(3), '-i', audio.path)
  }

  const filters: string[] = []
  if (audio && format !== 'gif') {
    if (audio.volume !== 1) filters.push(`volume=${audio.volume.toFixed(3)}`)
    if (audio.fadeInSeconds > 0) filters.push(`afade=t=in:d=${audio.fadeInSeconds.toFixed(3)}`)
    if (audio.fadeOutSeconds > 0) {
      const start = Math.max(0, durationSeconds - audio.fadeOutSeconds)
      filters.push(`afade=t=out:st=${start.toFixed(3)}:d=${audio.fadeOutSeconds.toFixed(3)}`)
    }
  }
  if (filters.length > 0) args.push('-af', filters.join(','))

  if (audio && format !== 'gif') {
    args.push('-map', '0:v:0', '-map', '1:a:0', '-t', durationSeconds.toFixed(3))
  } else {
    args.push('-t', durationSeconds.toFixed(3))
  }

  if (format === 'gif') {
    args.push(
      '-vf',
      `fps=${Math.min(fps, 15)},scale=min(960\\,iw):-2:flags=lanczos`,
      '-loop',
      '0',
      outputPath
    )
    return args
  }

  const hardware = request.hardware ? hardwareEncoder(request.platform) : null

  if (format === 'webm') {
    args.push('-c:v', 'libvpx-vp9', '-b:v', '4M', '-pix_fmt', 'yuv420p')
    if (audio) args.push('-c:a', 'libopus', '-b:a', '160k')
  } else if (hardware) {
    args.push('-c:v', hardware, '-b:v', '12M', '-pix_fmt', 'yuv420p')
    if (audio) args.push('-c:a', 'aac', '-b:a', '192k')
  } else {
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p')
    if (audio) args.push('-c:a', 'aac', '-b:a', '192k')
  }

  if (format === 'mp4') args.push('-movflags', '+faststart')
  args.push(outputPath)
  return args
}
