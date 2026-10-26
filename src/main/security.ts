import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, session, shell, type WebFrameMain } from 'electron'
import { is } from '@electron-toolkit/utils'

/**
 * Process-wide Electron hardening. The renderer only ever loads this app's own
 * pages, so anything else (other origins, new windows, webviews, unexpected
 * permission requests, IPC from foreign frames) is refused.
 */

const rendererRoot = (): string => pathToFileURL(join(__dirname, '../renderer/')).href

/** True for this app's own renderer pages, in development and in packaged builds. */
export const isAppUrl = (url: string | undefined | null): boolean => {
  if (!url) return false
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (is.dev && devUrl && url.startsWith(devUrl)) return true
  return url.startsWith(rendererRoot())
}

/** IPC is accepted only from a top-level frame showing one of the app's pages. */
export const isTrustedSender = (frame: WebFrameMain | null | undefined): boolean =>
  Boolean(frame && frame.parent === null && isAppUrl(frame.url))

const isHttpUrl = (url: string): boolean => /^https?:\/\//i.test(url)

/** Camera, microphone and screen capture are the only permissions the app uses. */
const ALLOWED_PERMISSIONS = new Set(['media', 'display-capture'])

export const installSecurityGuards = (): void => {
  app.on('web-contents-created', (_event, contents) => {
    // Links open in the user's browser; the app never opens its own new windows from a page.
    contents.setWindowOpenHandler(({ url }) => {
      if (isHttpUrl(url)) void shell.openExternal(url)
      return { action: 'deny' }
    })
    contents.on('will-navigate', (event, url) => {
      if (!isAppUrl(url)) event.preventDefault()
    })
    contents.on('will-redirect', (event, url) => {
      if (!isAppUrl(url)) event.preventDefault()
    })
    contents.on('will-attach-webview', (event) => {
      event.preventDefault()
    })
  })

  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    const origin = details.requestingUrl || contents.getURL()
    callback(ALLOWED_PERMISSIONS.has(permission) && isAppUrl(origin))
  })

  session.defaultSession.setPermissionCheckHandler((contents, permission, requestingOrigin) => {
    const origin = contents?.getURL() || requestingOrigin
    return ALLOWED_PERMISSIONS.has(permission) && isAppUrl(origin)
  })
}
