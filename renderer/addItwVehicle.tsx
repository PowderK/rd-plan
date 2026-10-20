import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { AddVehicleForm } from './components/AddVehicleForm';

const AddItwVehiclePage: React.FC = () => {
  return <AddVehicleForm vehicleType="itw" title="ITW hinzufügen" />;
};

const container = document.getElementById('add-itw-vehicle-root');
if (container) {
  const root = createRoot(container);
  root.render(<AddItwVehiclePage />);
}
