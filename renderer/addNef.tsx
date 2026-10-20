import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { AddVehicleForm } from './components/AddVehicleForm';

const AddNefPage: React.FC = () => {
  return <AddVehicleForm vehicleType="nef" title="NEF hinzufügen" />;
};

const container = document.getElementById('add-nef-root');
if (container) {
  const root = createRoot(container);
  root.render(<AddNefPage />);
}
