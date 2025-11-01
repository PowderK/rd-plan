import React from 'react';
import './styles.css';
import { createRoot } from 'react-dom/client';
import SettingsMenu from './components/SettingsMenu';

const container = document.getElementById('settings-root');
if (container) {
  const root = createRoot(container);
  root.render(<SettingsMenu onClose={() => window.close()} />);
}
