import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@renderer/App'
import { CameraBubble } from '@renderer/screens/CameraBubble'
import { RecorderToolbar } from '@renderer/screens/RecorderToolbar'
import '@renderer/styles/globals.css'

const container = document.getElementById('root')

if (!container) {
  throw new Error('Root element not found')
}

const isToolbar = window.location.hash === '#toolbar'
const isCamera = window.location.hash === '#camera'

// Floating windows have transparent backgrounds.
if (isToolbar || isCamera) {
  document.documentElement.classList.add('toolbar-window')
}

const root = isCamera ? <CameraBubble /> : isToolbar ? <RecorderToolbar /> : <App />

createRoot(container).render(<StrictMode>{root}</StrictMode>)
