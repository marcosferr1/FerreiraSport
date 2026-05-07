export type ThemeMode = 'light' | 'dark' | 'hybrid';

const STORAGE_KEY = 'themeMode';

export function getInitialThemeMode(): ThemeMode {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark' || saved === 'hybrid') return saved;
  // Recomendado según tus capturas de Figma: sidebar oscuro con contenido claro.
  return 'hybrid';
}

export function applyThemeMode(mode: ThemeMode) {
  // shadcn usa la clase `dark` en <html>.
  document.documentElement.classList.toggle('dark', mode === 'dark');
  document.documentElement.classList.toggle('hybrid', mode === 'hybrid');

  // Mejora el rendering de inputs/botones en algunos navegadores.
  document.documentElement.style.colorScheme = mode === 'dark' ? 'dark' : 'light';

  localStorage.setItem(STORAGE_KEY, mode);
}

