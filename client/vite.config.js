import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'park-tasks:3000', // Replace with your backend Render URL
      '/uploads': 'https://park-staff-backend.onrender.com', // Add for file serving
    },
  },
});