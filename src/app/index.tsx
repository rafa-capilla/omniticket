import React from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import App from '@/app/App';

const container = document.getElementById('root');
if (!container) {
  throw new Error("No se pudo encontrar el elemento root");
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);