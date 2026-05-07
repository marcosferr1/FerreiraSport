import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type ThemeMode = 'light' | 'dark' | 'hybrid'
type ThemeContextValue = {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'themeMode'

export type Palette = {
  background: string
  text: string
  sidebarBg: string
  sidebarText: string
  sidebarBorder: string
  cardBg: string
  cardBorder: string
  inputBg: string
  inputBorder: string
  primary: string
  primaryText: string
  mutedText: string
  dangerBg: string
  dangerText: string
}

const PALETTES: Record<ThemeMode, Palette> = {
  light: {
    background: '#F6F7FB',
    text: '#0B1220',
    sidebarBg: '#FFFFFF',
    sidebarText: '#0B1220',
    sidebarBorder: 'rgba(15, 23, 42, 0.10)',
    cardBg: '#FFFFFF',
    cardBorder: 'rgba(15, 23, 42, 0.10)',
    inputBg: '#FFFFFF',
    inputBorder: 'rgba(15, 23, 42, 0.15)',
    primary: '#1D4ED8',
    primaryText: '#FFFFFF',
    mutedText: 'rgba(11, 18, 32, 0.65)',
    dangerBg: 'rgba(239, 68, 68, 0.10)',
    dangerText: '#B91C1C',
  },
  dark: {
    background: '#0B1220',
    text: '#E5E7EB',
    sidebarBg: '#0F172A',
    sidebarText: '#E5E7EB',
    sidebarBorder: 'rgba(255, 255, 255, 0.10)',
    cardBg: 'rgba(15, 23, 42, 0.75)',
    cardBorder: 'rgba(255, 255, 255, 0.10)',
    inputBg: 'rgba(15, 23, 42, 0.35)',
    inputBorder: 'rgba(255, 255, 255, 0.15)',
    primary: '#2563EB',
    primaryText: '#FFFFFF',
    mutedText: 'rgba(229, 231, 235, 0.7)',
    dangerBg: 'rgba(239, 68, 68, 0.15)',
    dangerText: '#FCA5A5',
  },
  hybrid: {
    background: '#F6F7FB',
    text: '#0B1220',
    sidebarBg: '#0F172A',
    sidebarText: '#E5E7EB',
    sidebarBorder: 'rgba(255, 255, 255, 0.10)',
    cardBg: '#FFFFFF',
    cardBorder: 'rgba(15, 23, 42, 0.10)',
    inputBg: '#FFFFFF',
    inputBorder: 'rgba(15, 23, 42, 0.15)',
    primary: '#2563EB',
    primaryText: '#FFFFFF',
    mutedText: 'rgba(11, 18, 32, 0.65)',
    dangerBg: 'rgba(239, 68, 68, 0.10)',
    dangerText: '#B91C1C',
  },
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (saved === 'light' || saved === 'dark' || saved === 'hybrid') return saved
    return 'hybrid'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  const setMode = (next: ThemeMode) => setModeState(next)

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      setMode,
    }),
    [mode]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider')
  return ctx
}

export function usePalette(): Palette {
  const { mode } = useTheme()
  return PALETTES[mode]
}

export const paletteFor = (mode: ThemeMode) => PALETTES[mode]

