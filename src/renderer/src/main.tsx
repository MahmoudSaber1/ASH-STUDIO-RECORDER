import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@renderer/App'
import { RecorderToolbar } from '@renderer/screens/RecorderToolbar'
import '@renderer/styles/globals.css'

const container = document.getElementById('root')

if (!container) {
  throw new Error('Root element not found')
}

const isToolbar = window.location.hash === '#toolbar'

if (isToolbar) {
  document.documentElement.classList.add('toolbar-window')
}

createRoot(container).render(<StrictMode>{isToolbar ? <RecorderToolbar /> : <App />}</StrictMode>)
