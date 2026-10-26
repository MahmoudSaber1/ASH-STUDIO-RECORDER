import { useEffect, useRef, useState } from 'react'
import { drawFrame } from '@renderer/lib/render'
import { useEditor } from '@renderer/stores/editor'
import { outputSize } from '@shared/output'
import { mediaUrl } from '@shared/media'
import { loadBackgroundImage } from '@renderer/lib/backgrounds'

const PREVIEW_HEIGHT = 540

/**
 * Draws the same frame the exporter draws, at preview resolution. Redraws when
 * the playhead, the edit, or the seeked frame changes.
 */
export function Preview(): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const media = useEditor((state) => state.media)
  const editor = useEditor((state) => state.editor)
  const playheadMs = useEditor((state) => state.playheadMs)
  const frameVersion = useEditor((state) => state.frameVersion)
  const projectKey = useEditor((state) => state.key)
  const [assetVersion, setAssetVersion] = useState(0)

  const background = editor.background
  const backgroundUrl =
    background.kind === 'image' && projectKey ? mediaUrl(projectKey, background.fileName) : null

  // Image backgrounds load asynchronously; redraw once the image is ready.
  useEffect(() => {
    if (!backgroundUrl) return
    let active = true
    loadBackgroundImage(backgroundUrl)
      .then(() => {
        if (active) setAssetVersion((value) => value + 1)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [backgroundUrl])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!media || !canvas) return

    const sourceAspect = (media.screen.videoWidth || 16) / (media.screen.videoHeight || 9)
    const size = outputSize(editor.frame.aspect, PREVIEW_HEIGHT, sourceAspect)
    if (canvas.width !== size.width) canvas.width = size.width
    if (canvas.height !== size.height) canvas.height = size.height

    const ctx = canvas.getContext('2d')
    if (!ctx || media.screen.readyState < 2) return

    drawFrame({
      ctx,
      width: size.width,
      height: size.height,
      timeMs: playheadMs,
      editor,
      media,
      assetUrl: (fileName) => mediaUrl(projectKey ?? '', fileName)
    })
  }, [media, editor, playheadMs, frameVersion, projectKey, assetVersion])

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-white/8 bg-black/40 p-4">
      <canvas
        ref={canvasRef}
        aria-label="Preview"
        className="max-h-full max-w-full rounded-md shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]"
      />
    </div>
  )
}
