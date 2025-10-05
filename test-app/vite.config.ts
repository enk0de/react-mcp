import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['../babel-plugin-react-source-location/dist/index.js']],
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
});
