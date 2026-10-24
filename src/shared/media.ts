/** Scheme used by the renderer to play project media. The host is fixed to `media`. */
export const MEDIA_SCHEME = 'ash-media'

/** Builds the URL for one file in one project. The main process only serves listed files. */
export const mediaUrl = (key: string, fileName: string): string =>
  `${MEDIA_SCHEME}://media/${encodeURIComponent(key)}/${encodeURIComponent(fileName)}`
