import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}

// Suppress ResizeObserver loop error
const resizeObserverLoopErr = /ResizeObserver loop completed with undelivered notifications|ResizeObserver loop limit exceeded/;
const originalError = window.console.error;
window.console.error = (...args) => {
  if (args[0] && typeof args[0] === 'string' && resizeObserverLoopErr.test(args[0])) {
    return;
  }
  originalError(...args);
};

window.addEventListener('error', (e) => {
  const msg = e.message || '';
  if (resizeObserverLoopErr.test(msg)) {
    e.stopImmediatePropagation();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
