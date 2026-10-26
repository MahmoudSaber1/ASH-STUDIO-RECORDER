import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import type { Plugin } from 'vite'

const sharedAlias = { '@shared': resolve('src/shared') }

/**
 * Development needs inline scripts and the Vite dev server for hot reload.
 * Production builds drop both from the Content Security Policy.
 */
const strictProductionCsp = (): Plugin => ({
  name: 'ash-strict-production-csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html
      .replace("script-src 'self' 'unsafe-inline'", "script-src 'self'")
      .replace(' ws://localhost:* http://localhost:*', '')
      .replace(
        "default-src 'self';",
        "default-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none';"
      )
})

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { ...sharedAlias, '@main': resolve('src/main') }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: sharedAlias
    }
  },
  renderer: {
    plugins: [react(), tailwindcss(), strictProductionCsp()],
    resolve: {
      alias: { ...sharedAlias, '@renderer': resolve('src/renderer/src') }
    }
  }
})
