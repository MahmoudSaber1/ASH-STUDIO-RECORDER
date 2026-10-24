/** App preferences shared by the main process and the settings screen. */
export interface AppSettings {
  /** Folder that new recordings are saved into. Null means the default Videos folder. */
  recordingsFolder: string | null
}

export interface SettingsInfo {
  settings: AppSettings
  /** Folder recordings are actually written to, including env overrides. */
  effectiveRecordingsFolder: string
  logFile: string
}
