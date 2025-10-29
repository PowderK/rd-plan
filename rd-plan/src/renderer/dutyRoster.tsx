import React from 'react';
import { createRoot } from 'react-dom/client';
import DutyRoster from './components/DutyRoster';

const container = document.getElementById('duty-roster-root');
if (container) {
  const root = createRoot(container);
  root.render(<DutyRoster />);
}
