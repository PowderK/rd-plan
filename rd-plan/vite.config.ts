import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/renderer/index.html'),
        settings: resolve(__dirname, 'src/renderer/settings.html'),
        personnel: resolve(__dirname, 'src/renderer/personnel.html'),
        addPerson: resolve(__dirname, 'src/renderer/addPerson.html'),
        editPerson: resolve(__dirname, 'src/renderer/editPerson.html'),
        confirmDelete: resolve(__dirname, 'src/renderer/confirmDelete.html'),
        dutyRoster: resolve(__dirname, 'src/renderer/dutyRoster.html'),
        azubis: resolve(__dirname, 'src/renderer/azubis.html'),
        addAzubi: resolve(__dirname, 'src/renderer/azubiAdd.html'),
        editAzubi: resolve(__dirname, 'src/renderer/editAzubi.html'),
        itw: resolve(__dirname, 'src/renderer/itw.html'),
        addItw: resolve(__dirname, 'src/renderer/addItw.html'),
        editItw: resolve(__dirname, 'src/renderer/editItw.html'),
      },
    },
  },
  plugins: [react()],
});
