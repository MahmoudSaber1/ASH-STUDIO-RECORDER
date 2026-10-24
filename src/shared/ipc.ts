import type { AppInfo } from './app'
import type {
  CaptureSource,
  CaptureSourcesOptions,
  PermissionKind,
  PermissionState,
  PlatformCapabilities,
  Point
} from './platform'
import type { EditorState, ProjectFile, ProjectSummary } from './project'
import type { RecorderStartRequest, RecorderState, RecorderTrack } from './recorder'

export * from './app'
export * from './platform'
export * from './recorder'

export const IPC_CHANNELS = {
  appGetInfo: 'app:get-info',
  platformGetCapabilities: 'platform:get-capabilities',
  platformGetPermissions: 'platform:get-permissions',
  platformRequestPermission: 'platform:request-permission',
  platformOpenPermissionSettings: 'platform:open-permission-settings',
  platformGetSources: 'platform:get-sources',
  platformListWindows: 'platform:list-windows',
  platformGetCursorPosition: 'platform:get-cursor-position',
  recorderStart: 'recorder:start',
  recorderTrackStarted: 'recorder:track-started',
  recorderAppendChunk: 'recorder:append-chunk',
  recorderPause: 'recorder:pause',
  recorderResume: 'recorder:resume',
  recorderStop: 'recorder:stop',
  recorderStopComplete: 'recorder:stop-complete',
  recorderGetState: 'recorder:get-state',
  recorderOpenProjectFolder: 'recorder:open-project-folder',
  projectsList: 'projects:list',
  projectGet: 'projects:get',
  projectRename: 'projects:rename',
  projectDuplicate: 'projects:duplicate',
  projectDelete: 'projects:delete',
  projectSaveEditor: 'projects:save-editor',
  projectSaveThumbnail: 'projects:save-thumbnail',
  projectGetThumbnail: 'projects:get-thumbnail',
  projectImport: 'projects:import',
  projectExport: 'projects:export',
  projectReveal: 'projects:reveal'
} as const

export const IPC_EVENTS = {
  recorderState: 'recorder:state',
  recorderStartShortcut: 'recorder:start-shortcut'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

export interface IpcContract {
  [IPC_CHANNELS.appGetInfo]: { args: []; result: AppInfo }
  [IPC_CHANNELS.platformGetCapabilities]: { args: []; result: PlatformCapabilities }
  [IPC_CHANNELS.platformGetPermissions]: { args: []; result: PermissionState[] }
  [IPC_CHANNELS.platformRequestPermission]: {
    args: [kind: PermissionKind]
    result: PermissionState[]
  }
  [IPC_CHANNELS.platformOpenPermissionSettings]: {
    args: [kind: PermissionKind]
    result: boolean
  }
  [IPC_CHANNELS.platformGetSources]: {
    args: [options?: CaptureSourcesOptions]
    result: CaptureSource[]
  }
  [IPC_CHANNELS.platformListWindows]: { args: []; result: CaptureSource[] }
  [IPC_CHANNELS.platformGetCursorPosition]: { args: []; result: Point }
  [IPC_CHANNELS.recorderStart]: { args: [request: RecorderStartRequest]; result: RecorderState }
  [IPC_CHANNELS.recorderTrackStarted]: {
    args: [track: RecorderTrack, startedAt: number]
    result: void
  }
  [IPC_CHANNELS.recorderAppendChunk]: {
    args: [track: RecorderTrack, chunk: ArrayBuffer]
    result: void
  }
  [IPC_CHANNELS.recorderPause]: { args: [at?: number]; result: RecorderState }
  [IPC_CHANNELS.recorderResume]: { args: [at?: number]; result: RecorderState }
  [IPC_CHANNELS.recorderStop]: { args: []; result: RecorderState }
  [IPC_CHANNELS.recorderStopComplete]: { args: []; result: RecorderState }
  [IPC_CHANNELS.recorderGetState]: { args: []; result: RecorderState }
  [IPC_CHANNELS.recorderOpenProjectFolder]: { args: []; result: boolean }
  [IPC_CHANNELS.projectsList]: { args: []; result: ProjectSummary[] }
  [IPC_CHANNELS.projectGet]: { args: [key: string]; result: ProjectFile }
  [IPC_CHANNELS.projectRename]: { args: [key: string, name: string]; result: void }
  [IPC_CHANNELS.projectDuplicate]: { args: [key: string]; result: string }
  [IPC_CHANNELS.projectDelete]: { args: [key: string]; result: void }
  [IPC_CHANNELS.projectSaveEditor]: {
    args: [key: string, editor: EditorState]
    result: EditorState
  }
  [IPC_CHANNELS.projectSaveThumbnail]: { args: [key: string, data: ArrayBuffer]; result: void }
  [IPC_CHANNELS.projectGetThumbnail]: { args: [key: string]; result: string | null }
  [IPC_CHANNELS.projectImport]: { args: []; result: string | null }
  [IPC_CHANNELS.projectExport]: { args: [key: string]; result: string | null }
  [IPC_CHANNELS.projectReveal]: { args: [key: string]; result: boolean }
}

/** Contract exposed to the renderer through the preload bridge. */
export interface StudioApi {
  app: {
    getInfo: () => Promise<AppInfo>
  }
  platform: {
    getCapabilities: () => Promise<PlatformCapabilities>
    getPermissions: () => Promise<PermissionState[]>
    requestPermission: (kind: PermissionKind) => Promise<PermissionState[]>
    openPermissionSettings: (kind: PermissionKind) => Promise<boolean>
    getSources: (options?: CaptureSourcesOptions) => Promise<CaptureSource[]>
    listWindows: () => Promise<CaptureSource[]>
    getCursorPosition: () => Promise<Point>
  }
  projects: {
    list: () => Promise<ProjectSummary[]>
    get: (key: string) => Promise<ProjectFile>
    rename: (key: string, name: string) => Promise<void>
    duplicate: (key: string) => Promise<string>
    remove: (key: string) => Promise<void>
    saveEditor: (key: string, editor: EditorState) => Promise<EditorState>
    saveThumbnail: (key: string, data: ArrayBuffer) => Promise<void>
    getThumbnail: (key: string) => Promise<string | null>
    import: () => Promise<string | null>
    export: (key: string) => Promise<string | null>
    reveal: (key: string) => Promise<boolean>
  }
  recorder: {
    start: (request: RecorderStartRequest) => Promise<RecorderState>
    trackStarted: (track: RecorderTrack, startedAt: number) => Promise<void>
    appendChunk: (track: RecorderTrack, chunk: ArrayBuffer) => Promise<void>
    /** `at` is when the renderer actually paused its recorders (epoch ms). */
    pause: (at?: number) => Promise<RecorderState>
    resume: (at?: number) => Promise<RecorderState>
    stop: () => Promise<RecorderState>
    stopComplete: () => Promise<RecorderState>
    getState: () => Promise<RecorderState>
    openProjectFolder: () => Promise<boolean>
    onState: (listener: (state: RecorderState) => void) => () => void
    onStartShortcut: (listener: () => void) => () => void
  }
}
