import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../App.jsx';
import '../index.css';

// Register the same root-scope worker used by Firebase Cloud Messaging.
// The worker adds the app-shell cache and remains compatible with the FCM
// registration that supplies Firebase config in the URL query string.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js', { scope: '/' })
      .catch((error) => {
        console.warn('KELAS+ PWA service worker registration failed:', error);
      });
  });
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
