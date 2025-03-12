import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import App from './App';
import './i18n';

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

// calling IPC exposed from preload script
window.electron.ipcRenderer.once('ipc-5ire', (arg: any) => {
  // eslint-disable-next-line no-console
  localStorage.setItem('theme', arg.darkMode ? 'dark' : 'light');
});
