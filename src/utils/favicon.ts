import { safeFaviconUrl } from './commons'

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
 * 已知代价：0x3 主流站只返 **32×32** PNG（`size` 参数无效）。在 2 倍屏上图标会被放大 ~3 倍，
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

/** 已退役的代理地址：`/favicon/{domain}.png?size=128` */
const LEGACY_PROXY_RE = /^\/favicon\/([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)\.png/

/**
 * 站点图标的最终 URL：自定义图标 → 旧代理地址自愈 → 按站点域名走 0x3。
 *
 * 为什么要「自愈」那一档：删掉 `/favicon/[id].ts` 之后，**已经存进云端 Gist /
 * localStorage / 访客缓存里的旧地址不会自己更新**（实测线上有 5 个站点仍是
 * `/favicon/xxx.png?size=80`）。那个路径现在没有函数接管，Cloudflare Pages 的
 * SPA 回退会返回 index.html —— `<img>` 拿到 HTML 解不出图，静默走兜底色块，
 * 站长只会看到「这几个站点的图标变成了字母」，不会有任何报错。
 *
 * 放在读取点而不是「写回数据」：改写站长存的数据属于越权，而且云端那份他不一定
 * 立刻重新上传；读取时翻译对所有来源（Gist / 本地 / 访客缓存）一次生效。
 */
export function resolveFaviconUrl(custom?: string | null, siteUrl?: string) {
  const raw = (custom || '').trim()

  const legacy = raw.match(LEGACY_PROXY_RE)
  if (legacy)
    return getFaviconUrl(legacy[1])

  return safeFaviconUrl(raw) || getFaviconUrl(siteUrl || '')
}
