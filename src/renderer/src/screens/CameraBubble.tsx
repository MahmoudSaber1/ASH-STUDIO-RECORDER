import { useEffect, useRef, useState } from 'react'

const dragStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties

/**
 * Round, mirrored camera preview for the floating bubble window. It only shows
 * the camera to the speaker; the recorded webcam track comes from the capture
 * pipeline, so this window opens its own stream and closes it on unload.
 */
export function CameraBubble(): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const video = videoRef.current
    let stream: MediaStream | null = null
    let cancelled = false

    navigator.mediaDevices
      .getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 640 } }, audio: false })
      .then((next) => {
        if (cancelled) {
          next.getTracks().forEach((track) => track.stop())
          return
        }
        stream = next
        if (video) {
          video.srcObject = next
          void video.play().catch(() => undefined)
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Camera unavailable')
      })

    return () => {
      cancelled = true
      stream?.getTracks().forEach((track) => track.stop())
      if (video) video.srcObject = null
    }
  }, [])

  return (
    <div style={dragStyle} className="flex size-full items-center justify-center p-2">
      <div className="relative size-full overflow-hidden rounded-full border-[3px] border-white/90 bg-black shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Camera preview"
          className="size-full -scale-x-100 object-cover"
        />
        {error ? (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-[11px] text-zinc-300">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
