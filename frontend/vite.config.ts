import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Dockerコンテナ外（Macのブラウザ）からもアクセスできるようにホストを指定
    host: true, 
    // ★プロキシの設定
    proxy: {
      '/api': {
        target: 'http://app:8080', // Dockerネットワーク内でのGoコンテナのサービス名
        changeOrigin: true,
      }
    }
  }
})