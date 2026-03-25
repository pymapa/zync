import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'log-port',
      configureServer(server) {
        server.httpServer?.once('listening', () => {
          const address = server.httpServer?.address()
          if (address && typeof address === 'object') {
            console.log(`\n🚀 Frontend running at: http://localhost:${address.port}/\n`)
          }
        })
      },
    },
  ],
  server: {
    port: 5173,
    strictPort: false, // Allow fallback to another port if 5173 is in use
  },
  optimizeDeps: {
    include: ['leaflet', 'polyline-encoded'],
  },
})
