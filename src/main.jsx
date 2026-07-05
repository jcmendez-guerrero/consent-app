import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { DirtyProvider } from './contexts/DirtyContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <DirtyProvider>
          <App />
        </DirtyProvider>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>,
);
