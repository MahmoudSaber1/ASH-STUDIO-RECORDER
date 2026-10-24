import { describe, expect, it } from 'vitest'
import { buildFfmpegArgs, type ExportRequest } from '../ffmpeg-args'

const base: ExportRequest = {
  format: 'mp4',
  fileName: 'demo',
  width: 1920,
  height: 1080,
  fps: 30,
  durationSeconds: 12.5,
  hardware: false,
  platform: 'darwin',
  audio: null
}

describe('buildFfmpegArgs', () => {
  it('reads raw RGBA frames from stdin at the output size', () => {
    const args = buildFfmpegArgs(base, '/out/demo.mp4')
    expect(args).toEqual(
      expect.arrayContaining([
        '-f',
        'rawvideo',
        '-pix_fmt',
        'rgba',
        '-s',
        '1920x1080',
        '-r',
        '30',
        '-i',
        'pipe:0'
      ])
    )
    expect(args.at(-1)).toBe('/out/demo.mp4')
  })

  it('uses libx264 for mp4 unless hardware is requested', () => {
    expect(buildFfmpegArgs(base, 'x')).toContain('libx264')
    expect(buildFfmpegArgs({ ...base, hardware: true }, 'x')).toContain('h264_videotoolbox')
    expect(buildFfmpegArgs({ ...base, hardware: true, platform: 'linux' }, 'x')).toContain(
      'libx264'
    )
  })

  it('maps microphone audio with volume and fades when provided', () => {
    const args = buildFfmpegArgs(
      {
        ...base,
        audio: {
          path: '/p/microphone.webm',
          seekSeconds: 1,
          delaySeconds: 0,
          volume: 1.5,
          fadeInSeconds: 1,
          fadeOutSeconds: 2
        }
      },
      'x'
    )
    expect(args).toEqual(expect.arrayContaining(['-map', '0:v:0', '-map', '1:a:0', '-c:a', 'aac']))
    const filter = args[args.indexOf('-af') + 1]
    expect(filter).toBe('volume=1.500,afade=t=in:d=1.000,afade=t=out:st=10.500:d=2.000')
  })

  it('makes gif output without audio and with a palette-friendly fps cap', () => {
    const args = buildFfmpegArgs({ ...base, format: 'gif', fps: 60 }, 'x.gif')
    expect(args).not.toContain('-c:a')
    expect(args[args.indexOf('-vf') + 1]).toContain('fps=15')
  })
})
