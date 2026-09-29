/**
 * NavSync 站点图标缓存 Service Worker
 *
 * 解决的问题：站点图标是 `<img>` 直连外域（默认源 `site` = `{host}/favicon.ico`，
 * 备选 0x3 / Google / DuckDuckGo），这些外域的 Cache-Control 各不相同，
 * 不少 favicon.ico 不带长缓存头 → 浏览器每次刷新都要重新发起请求/协商缓存。
 *
 * 做法：拦截**跨域图片请求**（仅限 GET + destination=image），
 * 首次取回后存入 Cache Storage；之后的刷新直接由 SW 用本地缓存响应，
 * `<img>` 完全不发网络请求 —— 表现就是「首次加载完，之后读缓存」。
 *
 * 缓存失效路径：
 * 1. 强制刷新（Ctrl+Shift+R）：子资源请求带 no-cache/no-store/reload，
 *    SW 不读缓存、重新拉取并覆盖缓存条目 —— 即用户要求的「除非强制刷新」；
 * 2. 30 天 TTL（防止站点永久换图标后本地一直显示旧的）；
 * 3. 向 controller 发消息 `{ type: 'clear-favicon-cache' }` 可手动清空。
 *
 * 故意不拦的：同源请求（CF Pages 自带的 ETag 协商缓存已经够好）、
 * 非图片请求（页面/API/静态资源走浏览器默认行为，避免影响数据实时性）。
 * 拉取失败（断网/域名不可达）不写缓存，失败站点仍走组件的字母兜底。
 */

const CACHE_NAME = 'navsync-favicon-v1'
/** 缓存条目上限（含 meta 条目），超过后按最旧淘汰，防止 Cache Storage 无限膨胀 */
const MAX_ENTRIES = 2000
/** 缓存有效期：30 天。到期后即使有缓存也重新拉取 */
const TTL_MS = 30 * 24 * 60 * 60 * 1000
/** 每个图标 URL 配一条时间戳 meta（opaque 响应读不了 body，没法把时间写进响应头） */
const META_PREFIX = '__meta__:'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(
      names
        .filter(n => n.startsWith('navsync-favicon-') && n !== CACHE_NAME)
        .map(n => caches.delete(n)),
    )
    await self.clients.claim()
  })())
})

/** 手动清空入口（调试/站长换图标源用）：postMessage 给 controller 即可 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'clear-favicon-cache') {
    event.waitUntil(caches.delete(CACHE_NAME))
  }
})

/** 淘汰最旧条目，控制总量。meta 孤儿条目无害（只在对应图标命中时才读），新版本激活时整体重建 */
async function trimCache() {
  try {
    const cache = await caches.open(CACHE_NAME)
    const keys = await cache.keys()
    if (keys.length <= MAX_ENTRIES)
      return
    const excess = keys.length - MAX_ENTRIES
    for (let i = 0; i < excess; i++)
      await cache.delete(keys[i])
  }
  catch {
    // 淘汰失败不影响响应
  }
}

async function readFreshTimestamp(cache, metaKey) {
  const meta = await cache.match(metaKey)
  if (!meta)
    return 0
  try {
    const { t } = await meta.json()
    return Number(t) || 0
  }
  catch {
    return 0
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET')
    return

  let url
  try {
    url = new URL(req.url)
  }
  catch {
    return
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    return
  // 只管跨域图标：同源资源交给 CF Pages 的 HTTP 缓存
  if (url.origin === self.location.origin)
    return
  if (req.destination !== 'image')
    return

  // 强制刷新（Ctrl+Shift+R）时子资源带 no-cache/no-store/reload → 绕过本地缓存重新拉取
  const cacheMode = req.cache // TypeScript 不识别也无所谓，本文件是纯 JS
  const bypass = cacheMode === 'no-cache' || cacheMode === 'no-store' || cacheMode === 'reload'

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    const metaKey = META_PREFIX + req.url

    if (!bypass) {
      const hit = await cache.match(req)
      if (hit) {
        const savedAt = await readFreshTimestamp(cache, metaKey)
        if (!savedAt || Date.now() - savedAt < TTL_MS)
          return hit
        // 过期：走下面的网络重拉，取回后覆盖
      }
    }

    try {
      const res = await fetch(req)
      // opaque（no-cors 跨域图片）status 是 0，只要有响应体就算成功
      if (res && (res.ok || res.type === 'opaque')) {
        // 注意：cache.put 会消费 res，之后要用 match 取回再响应
        await cache.put(req, res)
        await cache.put(metaKey, new Response(JSON.stringify({ t: Date.now() }), {
          headers: { 'content-type': 'application/json' },
        }))
        event.waitUntil(trimCache())
        const stored = await cache.match(req)
        if (stored)
          return stored
      }
      return res
    }
    catch (err) {
      // 网络失败：有旧缓存就拿来救急，否则原样抛给 <img> 的 error 兜底
      const hit = await cache.match(req)
      if (hit)
        return hit
      throw err
    }
  })())
})
