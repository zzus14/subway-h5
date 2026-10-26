import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * 纯前端工程：线网数据与算路算法都打包在 bundle 里，没有后端、也没有 /api 代理。
 *
 * base 用相对路径，方便把 dist 丢到任意静态目录 / 子路径（如 GitHub Pages 的
 * https://<user>.github.io/<repo>/）下直接访问；路由用的是 hash 模式，不会 404。
 */
export default defineConfig({
  base: './',
  plugins: [vue()],
  server: {
    host: true,
    port: 5173
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500
  }
})
