import { createContext, useContext, useState, useEffect } from 'react';
import { getUser } from '../utils/api';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const user = getUser();
  const storageKey = user ? `theme_${user.id}` : 'theme_guest';

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem(storageKey) || 'dark';
  });

  // Re-read theme when user changes (login/logout)
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    setTheme(saved || 'dark');
  }, [storageKey]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(storageKey, theme);

    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }, [theme, storageKey]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
