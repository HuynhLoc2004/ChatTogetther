import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Fix "global is not defined" error
    global: 'window',
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  resolve: {
    alias: {
      // Đảm bảo Vite tìm đúng file cho sockjs-client
      'sockjs-client': 'sockjs-client/dist/sockjs.min.js',
    },
  },
})
