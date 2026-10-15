import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages serves the built site at /expense-tracker/. The dev
  // server (npm run dev) and tests keep using /.
  base: command === 'build' ? '/expense-tracker/' : '/',
}))
