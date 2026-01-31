import { createContext, useContext, useEffect, useState } from 'react';

type DarkModeContextType = {
  isDark: boolean;
  toggle: () => void;
};

const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined);

export function DarkModeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check if user prefers dark mode
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true);
    }
  }, []);

  useEffect(() => {
    // Apply dark mode class to the nearest parent element
    const element = document.querySelector('main');
    if (element) {
      if (isDark) {
        element.classList.add('dark');
        element.classList.add('bg-slate-900');
        element.classList.add('text-white');
      } else {
        element.classList.remove('dark');
        element.classList.remove('bg-slate-900');
        element.classList.remove('text-white');
      }
    }
  }, [isDark]);

  const toggle = () => setIsDark(!isDark);

  return (
    <DarkModeContext.Provider value={{ isDark, toggle }}>
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDarkMode() {
  const context = useContext(DarkModeContext);
  if (context === undefined) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return context;
}