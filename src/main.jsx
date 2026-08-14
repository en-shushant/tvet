import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './md.jsx'; // registers all @material/web custom elements
import App from './App.jsx';
import { FeedbackHost } from './components/ui/Feedback.jsx';

// FeedbackHost sits beside App rather than inside it so toasts and confirmations
// are available on every screen, including login and the initial loading state.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <FeedbackHost />
  </React.StrictMode>
);
