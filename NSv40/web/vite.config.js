import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000,
    // Code splitting intelligent
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'EVAL' && warning.id?.includes('lottie')) return;
        warn(warning);
      },
      output: {
        manualChunks: {
          // Vendor : React core
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Vendor : animations
          'vendor-motion': ['framer-motion'],
          // Vendor : Supabase
          'vendor-supabase': ['@supabase/supabase-js'],
          // Vendor : Lottie (lourd, chargé en dernier)
          'vendor-lottie': ['lottie-react'],
          // Vendor : UI libs
          'vendor-ui': ['lucide-react', '@radix-ui/react-slider', '@radix-ui/react-slot'],
        }
      }
    },
    // Minification agressive
    minify: 'esbuild',
    target: 'esnext',
  }
})
