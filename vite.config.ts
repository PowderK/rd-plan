import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  root: 'renderer',
  base: './',
  build: {
    outDir: '../dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'renderer/index.html'),
        settings: resolve(__dirname, 'renderer/settings.html'),
        personnel: resolve(__dirname, 'renderer/personnel.html'),
        addPerson: resolve(__dirname, 'renderer/addPerson.html'),
        editPerson: resolve(__dirname, 'renderer/editPerson.html'),
        confirmDelete: resolve(__dirname, 'renderer/confirmDelete.html'),
        dutyRoster: resolve(__dirname, 'renderer/dutyRoster.html'),
        azubis: resolve(__dirname, 'renderer/azubis.html'),
        addAzubi: resolve(__dirname, 'renderer/azubiAdd.html'),
        editAzubi: resolve(__dirname, 'renderer/editAzubi.html'),
        itw: resolve(__dirname, 'renderer/itw.html'),
        addItw: resolve(__dirname, 'renderer/addItw.html'),
        editItw: resolve(__dirname, 'renderer/editItw.html'),
        vehicles: resolve(__dirname, 'renderer/vehicles.html'),
        addRtw: resolve(__dirname, 'renderer/addRtw.html'),
        addNef: resolve(__dirname, 'renderer/addNef.html'),
        values: resolve(__dirname, 'renderer/values.html'),
      },
    },
  },
  plugins: [react()],
});
