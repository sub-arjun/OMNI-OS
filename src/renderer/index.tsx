import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import App from './App';
import './i18n';

// Override console.error to filter out Keyborg disposal warnings in development
if (process.env.NODE_ENV === 'development') {
  const originalError = console.error;
  console.error = (...args) => {
    // Filter out Keyborg disposal errors which are non-critical warnings
    if (args[0] && typeof args[0] === 'string' && 
        args[0].includes('Keyborg instance') && 
        args[0].includes('is being disposed incorrectly')) {
      // Log as warning instead of error
      console.warn('[Keyborg Warning]', ...args);
      return;
    }
    originalError.apply(console, args);
  };
}

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);

// In production, use StrictMode normally
// In development, we can choose to disable it to avoid double-rendering issues
const AppWrapper = process.env.NODE_ENV === 'production' ? (
  <StrictMode>
    <App />
  </StrictMode>
) : (
  <App />
);

root.render(AppWrapper);

// calling IPC exposed from preload script
window.electron.ipcRenderer.once('ipc-5ire', (arg: any) => {
  // eslint-disable-next-line no-console
  localStorage.setItem('theme', arg.darkMode ? 'dark' : 'light');
});
