import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/styles.css';

const rootEl = document.getElementById('root')!;
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
