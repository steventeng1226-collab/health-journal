import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// ── 自動清除舊版 Service Worker 與快取 ──────────────
// 每次部署新版時，註銷所有舊的 Service Worker 並清除 Cache
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}
if ('caches' in window) {
  caches.keys().then(names => {
    for (const name of names) {
      caches.delete(name);
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
