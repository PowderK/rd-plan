import React from 'react';
import { createRoot } from 'react-dom/client';
import PersonnelOverview from './components/PersonnelOverview';

const container = document.getElementById('personnel-root');
if (container) {
  const root = createRoot(container);
  root.render(<PersonnelOverview />);
}
