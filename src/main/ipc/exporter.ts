import { IPC_CHANNELS } from '@shared/ipc'
import type { ExportSettings } from '@shared/export'
import { cancelExport, finishExport, startExport, writeFrame } from '@main/media/exporter'
import type { ExportAudio } from '@main/media/ffmpeg-args'
import { resolveMediaPath } from '@main/projects/store'
import { getRecordingsRoot } from '@main/recorder/paths'
import { handleIpc } from './handle'

/** Turns the renderer's project-relative audio reference into a checked absolute path. */
const resolveAudio = async (settings: ExportSettings): Promise<ExportAudio | null> => {
  if (!settings.audio) return null

  const path = await resolveMediaPath(
    getRecordingsRoot(),
    settings.projectKey,
    settings.audio.fileName
  )
  if (!path) throw new Error('The microphone track is missing from this project')

  return {
    path,
    seekSeconds: settings.audio.seekSeconds,
    delaySeconds: settings.audio.delaySeconds,
    volume: settings.audio.volume,
    fadeInSeconds: settings.audio.fadeInSeconds,
    fadeOutSeconds: settings.audio.fadeOutSeconds
  }
}

export function registerExportHandlers(): void {
  handleIpc(IPC_CHANNELS.exportStart, async (settings) =>
    startExport({
      ...settings,
      audio: await resolveAudio(settings),
      platform: process.platform
    })
  )
  handleIpc(IPC_CHANNELS.exportFrame, (id, frame) => writeFrame(id, frame))
  handleIpc(IPC_CHANNELS.exportFinish, (id) => finishExport(id))
  handleIpc(IPC_CHANNELS.exportCancel, (id) => cancelExport(id))
}
