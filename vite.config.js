import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = process.env.PORT || env.PORT || '4000'

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('/node_modules/')) return undefined
            const packagePath = id.split('/node_modules/')[1]
            const packageName = packagePath.startsWith('@')
              ? packagePath.split('/').slice(0, 2).join('/')
              : packagePath.split('/')[0]

            if (['react', 'react-dom', 'scheduler'].includes(packageName)) return 'react-vendor'
            if (['react-router', 'react-router-dom'].includes(packageName)) return 'router-vendor'
            if (packageName === 'lucide-react') return 'icons-vendor'
            if (packageName === 'framer-motion') return 'motion-vendor'
            if (packageName === '@react-oauth/google') return 'google-auth-vendor'
            if (packageName === 'recharts' || packageName.startsWith('d3-')) return 'charts-vendor'
            return undefined
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
