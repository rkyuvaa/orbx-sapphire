import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  reduceMotion: boolean;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  toggleReduceMotion: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    document.documentElement.dataset.theme = 'light';
    return 'light';
  });

  const [reduceMotion, setReduceMotion] = useState<boolean>(() => {
    return localStorage.getItem('orbx-reduce-motion') === 'true';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('orbx-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('rm', reduceMotion);
    localStorage.setItem('orbx-reduce-motion', String(reduceMotion));
  }, [reduceMotion]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const toggleReduceMotion = () => {
    setReduceMotion((prev) => !prev);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        reduceMotion,
        toggleTheme,
        setTheme: setThemeState,
        toggleReduceMotion,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
