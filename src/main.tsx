import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-800.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import './styles.css';
const PartsPage = lazy(() => import('./PartsPage'));
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {new URLSearchParams(location.search).get('view') === 'parts' ? (
      <Suspense fallback={<div className="load-state">正在打开配件图鉴…</div>}>
        <PartsPage />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
