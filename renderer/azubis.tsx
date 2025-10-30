import React from 'react';
import { createRoot } from 'react-dom/client';
import AzubiOverview from './components/AzubiOverview';

const root = createRoot(document.getElementById('root')!);
root.render(<AzubiOverview />);
