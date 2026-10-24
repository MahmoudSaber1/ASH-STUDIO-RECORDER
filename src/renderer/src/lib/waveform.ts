/**
 * Peak values for drawing a waveform. Decodes the audio once and keeps the
 * largest absolute sample per bucket, which is what the eye reads as loudness.
 */
export const computePeaks = (channel: Float32Array, buckets: number): Float32Array => {
  const peaks = new Float32Array(buckets)
  if (channel.length === 0 || buckets <= 0) return peaks

  const step = channel.length / buckets
  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const from = Math.floor(bucket * step)
    const to = Math.min(channel.length, Math.floor((bucket + 1) * step))
    let peak = 0
    for (let index = from; index < to; index += 1) {
      const value = Math.abs(channel[index] ?? 0)
      if (value > peak) peak = value
    }
    peaks[bucket] = peak
  }

  return peaks
}

export const loadWaveform = async (url: string, buckets: number): Promise<Float32Array | null> => {
  const context = new AudioContext()
  try {
    const bytes = await fetch(url).then((response) => (response.ok ? response.arrayBuffer() : null))
    if (!bytes) return null
    const audio = await context.decodeAudioData(bytes)
    return computePeaks(audio.getChannelData(0), buckets)
  } catch {
    return null
  } finally {
    await context.close()
  }
}
