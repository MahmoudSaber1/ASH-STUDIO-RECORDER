// electron-builder hook: writes SHA-256 checksums for this job's installers and
// returns the file, so it is published to the same draft release.
const { createHash } = require('node:crypto')
const { createReadStream, writeFileSync } = require('node:fs')
const { basename, join } = require('node:path')

const sha256 = (path) =>
  new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')))
  })

module.exports = async (buildResult) => {
  const installers = buildResult.artifactPaths.filter((path) => /\.(dmg|zip|exe)$/.test(path))
  if (installers.length === 0) return []

  const lines = []
  for (const path of installers) lines.push(`${await sha256(path)}  ${basename(path)}`)

  const platform =
    process.platform === 'darwin'
      ? 'mac'
      : process.platform === 'win32'
        ? 'windows'
        : process.platform
  const arches = [
    ...new Set(installers.map((path) => /-(arm64|x64)[.-]/.exec(path)?.[1]).filter(Boolean))
  ]
  const file = join(
    buildResult.outDir,
    `SHA256SUMS-${platform}${arches.length ? `-${arches.join('-')}` : ''}.txt`
  )
  writeFileSync(file, `${lines.join('\n')}\n`)
  return [file]
}
