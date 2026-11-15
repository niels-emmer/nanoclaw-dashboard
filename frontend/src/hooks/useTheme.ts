import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'

const THEME_STORAGE_KEY = 'heroui-theme'
const PREFERS_DARK_MEDIA = '(prefers-color-scheme: dark)'

function subscribeSystemPreference(callback: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const media = window.matchMedia(PREFERS_DARK_MEDIA)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

function getSystemPreference(): 'dark' | 'light' {
  return window.matchMedia?.(PREFERS_DARK_MEDIA).matches ? 'dark' : 'light'
}

function getServerSystemPreference(): undefined {
  return undefined
}

function applyThemeToDOM(resolved: string, previous: string | undefined): void {
  if (previous === resolved) return
  if (previous) {
    document.documentElement.classList.remove(previous)
  }
  document.documentElement.classList.add(resolved)
  document.documentElement.setAttribute('data-theme', resolved)
}

export function useTheme(defaultTheme = 'system') {
  const [theme, setThemeState] = useState<string>(() => {
    if (typeof window === 'undefined') return defaultTheme
    return localStorage.getItem(THEME_STORAGE_KEY) ?? defaultTheme
  })

  const systemTheme = useSyncExternalStore(
    subscribeSystemPreference,
    getSystemPreference,
    getServerSystemPreference,
  )

  const resolvedTheme = theme === 'system' ? systemTheme : theme
  const appliedRef = useRef<string | undefined>(undefined)

  useLayoutEffect(() => {
    if (!resolvedTheme) return
    applyThemeToDOM(resolvedTheme, appliedRef.current)
    appliedRef.current = resolvedTheme
  }, [resolvedTheme])

  const setTheme = useCallback((newTheme: string) => {
    if (typeof window === 'undefined') return
    localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    setThemeState(newTheme)
  }, [])

  return {
    resolvedTheme,
    setTheme,
    theme,
  }
}
