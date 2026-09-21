import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/styles/tokens.css';
import './app/styles/base.css';
import './app/styles/markdown.css';
import './app/styles/components.css';
import './app/styles/layout.css';
import './app/styles/print.css';

const rootEl = document.getElementById('root')!;
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
