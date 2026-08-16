import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { AddVehicleForm } from './components/AddVehicleForm';

const AddRtwPage: React.FC = () => {
  return <AddVehicleForm vehicleType="rtw" title="RTW hinzufügen" />;
};

const container = document.getElementById('add-rtw-root');
if (container) {
  const root = createRoot(container);
  root.render(<AddRtwPage />);
}
