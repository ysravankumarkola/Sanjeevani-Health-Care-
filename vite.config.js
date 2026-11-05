import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'charts', test: /[\\/]node_modules[\\/]recharts[\\/]/ },
            { name: 'motion', test: /[\\/]node_modules[\\/]framer-motion[\\/]/ },
          ],
        },
      },
    },
  },
})
