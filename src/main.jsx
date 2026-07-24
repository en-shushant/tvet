import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './md.jsx'; // registers all @material/web custom elements
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
