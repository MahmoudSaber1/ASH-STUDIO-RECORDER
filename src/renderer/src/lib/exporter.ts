import { buildSegments, outputDurationMs, outputToSource } from '@shared/timeline'
import { outputSize, RESOLUTION_HEIGHTS, type ResolutionPreset } from '@shared/output'
import type { ExportAudioSettings, ExportFormat, ExportSettings } from '@shared/export'
import type { EditorState, ProjectFile } from '@shared/project'
import { drawFrame } from './render'
import { loadBackgroundImage } from './backgrounds'
import { mediaUrl } from '@shared/media'
import type { ProjectMedia } from './project-media'

export interface ExportOptions {
  format: ExportFormat
  resolution: ResolutionPreset
  fps: 30 | 60
  hardware: boolean
  includeAudio: boolean
}

export interface ExportProgress {
  frame: number
  total: number
}

/**
 * Renders the edited timeline frame by frame through the same drawFrame used
 * by the preview, then streams the RGBA pixels to FFmpeg in the main process.
 */
export const runExport = async (args: {
  key: string
  project: ProjectFile
  media: ProjectMedia
  editor: EditorState
  options: ExportOptions
  signal: AbortSignal
  onProgress: (progress: ExportProgress) => void
}): Promise<string | null> => {
  const { project, media, editor, options, signal, onProgress } = args
  const segments = buildSegments(media.durationMs, editor)
  const durationMs = outputDurationMs(segments)
  if (durationMs <= 0) throw new Error('Nothing to export: the timeline is empty')

  const sourceAspect = (media.screen.videoWidth || 16) / (media.screen.videoHeight || 9)
  const size = outputSize(editor.frame.aspect, RESOLUTION_HEIGHTS[options.resolution], sourceAspect)
  const total = Math.max(1, Math.round((durationMs / 1000) * options.fps))

  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d', { willReadFrequently: false })
  if (!ctx) throw new Error('Canvas is not available')

  const audio =
    options.includeAudio && media.mic && project.tracks.microphone
      ? audioSettings(project, media, editor)
      : null

  const settings: ExportSettings = {
    format: options.format,
    projectKey: args.key,
    fileName: project.name.replace(/[\\/:*?"<>|]/g, '_'),
    width: size.width,
    height: size.height,
    fps: options.fps,
    durationSeconds: durationMs / 1000,
    hardware: options.hardware,
    audio
  }

  const assetUrl = (fileName: string): string => mediaUrl(args.key, fileName)
  // Every frame must have its background, so wait for an image background first.
  if (editor.background.kind === 'image') {
    await loadBackgroundImage(assetUrl(editor.background.fileName))
  }

  const id = await window.api.exporter.start(settings)
  if (!id) return null

  try {
    for (let frame = 0; frame < total; frame += 1) {
      if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError')

      const outputMs = (frame * 1000) / options.fps
      const sourceMs = outputToSource(outputMs, segments)

      await media.seekScreen(sourceMs)
      await media.seekWebcam(sourceMs)

      drawFrame({
        ctx,
        width: size.width,
        height: size.height,
        timeMs: sourceMs,
        editor,
        media,
        assetUrl
      })

      const pixels = ctx.getImageData(0, 0, size.width, size.height).data.buffer
      await window.api.exporter.frame(id, pixels)
      onProgress({ frame: frame + 1, total })
    }

    return await window.api.exporter.finish(id)
  } catch (error) {
    await window.api.exporter.cancel(id).catch(() => undefined)
    throw error
  }
}

/** Audio is only mixed when the output is one continuous piece of the source. */
const audioSettings = (
  project: ProjectFile,
  media: ProjectMedia,
  editor: EditorState
): ExportAudioSettings | null => {
  const file = project.tracks.microphone?.fileName
  if (!file) return null
  if (editor.cuts.length > 0 || editor.speedRamps.length > 0) return null

  const start = editor.trim?.start ?? 0
  const micStartTimeline = media.micOffsetMs
  const seekMs = start - micStartTimeline
  const { audio } = editor

  return {
    fileName: file,
    seekSeconds: Math.max(0, seekMs) / 1000,
    delaySeconds: Math.max(0, -seekMs) / 1000,
    volume: audio.micVolume,
    fadeInSeconds: audio.fadeInMs / 1000,
    fadeOutSeconds: audio.fadeOutMs / 1000
  }
}

export const formatExportError = (error: unknown): string =>
  error instanceof Error ? error.message : 'Export failed'
