import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useTheme } from './hooks/useTheme'
import './index.css'
import App from './App.tsx'

export function Root() {
  useTheme('dark')
  return (
    <StrictMode>
      <App />
    </StrictMode>
  )
}

createRoot(document.getElementById('root')!).render(<Root />)
