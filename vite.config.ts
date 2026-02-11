import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Usa rutas relativas para que funcione en cualquier subcarpeta de GitHub
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser', // Optimización máxima de tamaño
    rollupOptions: {
      output: {
        // Evita nombres de archivos extraños que puedan dar problemas de caché
        manualChunks: {
          vendor: ['react', 'react-dom', 'recharts'],
        },
      },
    },
  },
});