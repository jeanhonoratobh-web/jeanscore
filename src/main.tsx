/**
 * Browser entry point (`src/main.tsx`).
 *
 * Boots the React 18 tree with the concurrent `createRoot` API and mounts
 * {@link App} into the `#root` element declared in `index.html`. Design_Token
 * CSS Custom Properties are imported here (`theme/tokens.css`) so the variables
 * that every component and `[data-theme]` block relies on are present before
 * the first paint (Requirement 4.1).
 *
 * `React.StrictMode` wraps the app to surface unsafe lifecycles and side-effect
 * bugs during development; it has no effect on the production bundle.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@/theme/tokens.css';
import '@/theme/base.css';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Root element "#root" not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
