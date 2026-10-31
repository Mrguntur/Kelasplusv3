import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The public website owns /; the authenticated app is mounted at /app/.
  base: '/app/',
  server: { port: 5173, strictPort: true },
});
