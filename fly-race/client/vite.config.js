import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const shared = path.resolve(here, '../shared');

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@shared': shared } },
  server: {
    port: 5173,
    // Allow importing the simulation that lives outside the client root.
    fs: { allow: [here, shared] },
    proxy: { '/api': 'http://localhost:4000' },
  },
});
