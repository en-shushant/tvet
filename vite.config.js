import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          docx: ['docx', 'file-saver'],
        },
      },
    },
  },
  server: { proxy: { '/api': 'http://localhost:4000' } }
})
