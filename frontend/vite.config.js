import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const permissionsPolicyHeader = [
  'accelerometer=(self "https://api.razorpay.com")',
  'gyroscope=(self "https://api.razorpay.com")',
  'magnetometer=(self "https://api.razorpay.com")',
  'payment=(self "https://api.razorpay.com")',
].join(', ')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_BUILD_ID__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    headers: {
      'Permissions-Policy': permissionsPolicyHeader,
    },
  },
  preview: {
    headers: {
      'Permissions-Policy': permissionsPolicyHeader,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/')
          if (normalizedId.includes('/node_modules/html5-qrcode/')) return 'qr-scanner'
          if (normalizedId.includes('/node_modules/react/')
            || normalizedId.includes('/node_modules/react-dom/')
            || normalizedId.includes('/node_modules/scheduler/')) return 'react-vendor'
          if (normalizedId.includes('/node_modules/recharts/')
            || normalizedId.includes('/node_modules/d3-')
            || normalizedId.includes('/node_modules/redux/')) return 'charts-vendor'
          if (normalizedId.includes('/node_modules/lucide-react/')) return 'icons-vendor'
          if (normalizedId.includes('/node_modules/axios/')) return 'http-vendor'
          if (normalizedId.includes('/node_modules/qrcode.react/')
            || normalizedId.includes('/node_modules/qrcode/')) return 'qr-renderer-vendor'
          return undefined
        },
      },
    },
  },
})
