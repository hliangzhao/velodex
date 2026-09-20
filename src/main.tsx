import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LibraryProvider } from './Library';
import Discover from './Discover';
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-800.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import './styles.css';
import './experience.css';
const WorkshopPage = lazy(() => import('./WorkshopPage'));
const FeedbackPage = lazy(() => import('./FeedbackPage'));
const PartsPage = lazy(() => import('./PartsPage'));
const ComparePage = lazy(() => import('./ComparePage'));
const GaragePage = lazy(() => import('./GaragePage'));
const StoriesPage = lazy(() => import('./StoriesPage'));
const params = new URLSearchParams(location.search);
const view = params.get('view');
const page =
  view === 'workshop' ? (
    <WorkshopPage />
  ) : view === 'feedback' ? (
    <FeedbackPage />
  ) : view === 'parts' ? (
    <PartsPage />
  ) : view === 'compare' ? (
    <ComparePage />
  ) : view === 'garage' ? (
    <GaragePage />
  ) : view === 'stories' ? (
    <StoriesPage />
  ) : params.has('bike') ? (
    <App />
  ) : view === 'bikes' || ['#collection', '#brands'].includes(location.hash) ? (
    <App browse />
  ) : (
    <Discover />
  );
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LibraryProvider>
      <Suspense fallback={<div className="load-state">正在打开图鉴…</div>}>{page}</Suspense>
    </LibraryProvider>
  </React.StrictMode>,
);
