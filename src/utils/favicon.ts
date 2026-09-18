/**
 * 站点图标 URL 构造。
 *
 * 2026-09-18 改造：浏览器直接 `<img>` 加载 `https://0x3.com/icon?host={domain}`，
 * 不再走本站 `/favicon/[id].png` Pages Function 代理。理由：
 * 1) 旧代理每次冷访问 1~2s，是首屏第二大成本（仅次于 JS 资源数 × RTT）；
 * 2) 0x3 没有 CORS 限制（`<img>` 不受 CORS 约束），浏览器可直连；
 * 3) 0x3 自身响应头 `Cache-Control: public, max-age=2592000`（30 天）+ 浏览器缓存，
 *    二次访问直接命中，链路与代理的 KV 缓存几乎等效但少一跳。
 *
 * 已知代价：0x3 只返 **32×32** PNG（`size` 参数无效）。在 2 倍屏上图标会被放大 ~3 倍，
 * 比改造前的 128px 源要糊一些。**速度优先于像素清晰度是这次改造的取舍**。
 */
function getDomainName(url: string) {
  let domain = url.replace(/(^\w+:|^)\/\//, '')
  domain = domain.replace(/^www\./, '')

  const matches = domain.match(/([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/)

  if (matches && matches.length > 1)
    return matches[1]

  return null
}

export function getFaviconUrl(url: string) {
  const domain = getDomainName(url)
  if (domain == null)
    return ''

  // 直接调 0x3；0x3 无 CORS，可作为 `<img src>` 跨域加载。
  return `https://0x3.com/icon?host=${domain}`
}
