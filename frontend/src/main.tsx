import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ErrorBoundary } from './components/foundation/ErrorBoundary';
import { UnsupportedBrowser } from './components/foundation/UnsupportedBrowser';
import { getBrowserCapabilities } from './utils/browserCapabilities';
import './styles/tailwind.css';
import './styles/theme.css';
import './styles/responsive.css';

const capabilities = getBrowserCapabilities();

if (import.meta.env.PROD && window.isSecureContext) {
  registerSW({ immediate: true });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      {capabilities.isSupported ? <App /> : <UnsupportedBrowser missingFeatures={capabilities.missingFeatures} />}
    </ErrorBoundary>
  </React.StrictMode>
);
