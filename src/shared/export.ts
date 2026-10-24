export type ExportFormat = 'mp4' | 'webm' | 'gif'

export interface ExportAudioSettings {
  /** Microphone file name inside the project folder. */
  fileName: string
  /** Seconds to skip into the microphone file before the output starts. */
  seekSeconds: number
  /** Seconds of silence before the audio, when the microphone started later. */
  delaySeconds: number
  volume: number
  fadeInSeconds: number
  fadeOutSeconds: number
}

/** What the renderer sends to start an export. */
export interface ExportSettings {
  /** Folder name of the project the media comes from. */
  projectKey: string
  format: ExportFormat
  fileName: string
  width: number
  height: number
  fps: number
  durationSeconds: number
  hardware: boolean
  audio: ExportAudioSettings | null
}
