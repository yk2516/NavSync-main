import path from 'node:path'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import VueJsx from '@vitejs/plugin-vue-jsx'
import Pages from 'vite-plugin-pages'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import VueMacros from 'unplugin-vue-macros/vite'
import Unocss from 'unocss/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  plugins: [
    Vue(),
    VueJsx(),
    Unocss(),
    Pages(),
    VueMacros(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia', '@vueuse/core', 'vue/macros'],
      dts: 'src/auto-imports.d.ts',
      dirs: ['src/composables', 'src/stores'],
      vueTemplate: true,
    }),
    Components({
      resolvers: [NaiveUiResolver()],
      dirs: ['src/components/**'],
      extensions: ['vue', 'tsx'],
      dts: 'src/components.d.ts',
    }),
    // VueSetupExtend(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    // vite-plugin-pages 生成的路由表是虚拟模块（virtual:generated-pages），
    // 依赖扫描器（esbuild）跟不进去，于是页面里用到的 dayjs / vuedraggable /
    // axios / axios-jsonp / @vueuse/components 全部漏扫。
    // 后果：dev 启动后首次访问某个页面时才被发现，触发一次
    // 「optimized dependencies changed. reloading」整页重载（开发体验很差）。
    // 把页面目录一并作为扫描入口，首次启动就收全。
    entries: ['index.html', 'src/pages/**/*.vue'],
  },
  server: {
    port: 1888,
  },
})
