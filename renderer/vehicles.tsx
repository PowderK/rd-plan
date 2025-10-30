import React from 'react';
import { createRoot } from 'react-dom/client';
import Vehicles from './components/Vehicles';

const container = document.getElementById('vehicles-root');
if (container) {
  const root = createRoot(container);
  root.render(<Vehicles />);
}
