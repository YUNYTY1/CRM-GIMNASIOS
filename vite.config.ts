import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          graficos: ['recharts'],
          escaner: ['@yudiel/react-qr-scanner'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
})
