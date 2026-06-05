import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// ── Service Worker 管理 ──────────────────────────────
const SW_VERSION = 'v2.5';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // 先清除所有舊的 SW
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        const swUrl = reg.active?.scriptURL || '';
        // 如果不是我們的新版SW，清除
        if (!swUrl.includes('sw.js')) {
          await reg.unregister();
        }
      }
      // 清除舊版快取
      const keys = await caches.keys();
      for (const key of keys) {
        if (!key.includes(SW_VERSION)) {
          await caches.delete(key);
        }
      }
      // 註冊新版 SW
      const reg = await navigator.serviceWorker.register(
        '/health-journal/sw.js',
        { scope: '/health-journal/' }
      );
      console.log('SW registered:', reg.scope);
    } catch (e) {
      console.log('SW registration failed:', e);
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
