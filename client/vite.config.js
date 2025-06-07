import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'https://park-tasks.onrender.com', // Backend URL
      '/uploads': 'https://park-tasks.onrender.com', // For file serving
    },
  },
});