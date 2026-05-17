import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const useHttps = process.env.VITE_DEV_HTTPS === 'true';

export default defineConfig({
  plugins: useHttps ? [react(), basicSsl()] : [react()],
  server: {
    https: useHttps,
    host: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
