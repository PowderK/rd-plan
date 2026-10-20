import React from 'react';
import { createRoot } from 'react-dom/client';
import ValuesPage from './components/ValuesPage';
import { AuthProvider } from './contexts/AuthContext';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <AuthProvider>
      <ValuesPage />
    </AuthProvider>
  );
}
