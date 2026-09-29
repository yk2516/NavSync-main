import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import 'uno.css'
import '@/styles/index.scss'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

// 站点图标本地缓存（public/sw.js）：拦截跨域图片请求，首次加载后存 Cache Storage，
// 之后刷新直接由 SW 本地响应；强制刷新（no-cache/no-store）自动绕过重拉。
// 仅生产注册；注册失败静默 —— 缓存只是加速，不注册也不影响任何功能。
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
