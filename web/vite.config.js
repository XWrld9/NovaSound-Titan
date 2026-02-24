import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      onwarn(warning, warn) {
        // Ignorer le warning eval de lottie-web (bibliothèque tierce, non modifiable)
        if (warning.code === 'EVAL' && warning.id?.includes('lottie')) return;
        warn(warning);
      }
    }
  }
})
