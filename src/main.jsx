import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './md.jsx'; // registers all @material/web custom elements
import App from './App.jsx';
import { FeedbackHost } from './components/ui/Feedback.jsx';

/**
 * Routes are code-split (ReportsView, Shortlisting, ...), so a tab left open
 * across a deploy asks for a chunk the new build has deleted. Vite wraps every
 * dynamic import and fires this event when one 404s, instead of leaving it an
 * uncaught rejection. Reloading picks up the current index.html and its
 * current chunk hashes — which is what a manual refresh already fixed, this
 * just does it automatically instead of leaving the screen blank.
 *
 * Guarded to once per tab: a real network outage would 404 the reload's own
 * request too, and retrying that forever is worse than showing the error.
 */
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  if (sessionStorage.getItem('tvettrack_reloaded_for_stale_chunk')) return;
  sessionStorage.setItem('tvettrack_reloaded_for_stale_chunk', '1');
  window.location.reload();
});

// FeedbackHost sits beside App rather than inside it so toasts and confirmations
// are available on every screen, including login and the initial loading state.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <FeedbackHost />
  </React.StrictMode>
);

// A successful mount means this load's chunks are all current; clear the
// once-per-tab guard so a *later* deploy, while this tab is still open, can
// still trigger the auto-reload above instead of being silently skipped.
sessionStorage.removeItem('tvettrack_reloaded_for_stale_chunk');
