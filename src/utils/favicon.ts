// 图标获取统一走本站 Pages Functions 代理（/favicon/{domain}.png），
// 由后端请求第三方源（DuckDuckGo / 0x3 / Google）并写入 KV 缓存，
// 避免浏览器直连第三方接口的跨域与稳定性问题。
const FAVICON_API = '/favicon/'

/**
 * 附在 URL 上的尺寸提示。
 *
 * 真正决定上游请求尺寸的是 `functions/favicon/[id].ts` 里的 `FAVICON_SIZE`
 * （后端按该值固定请求，本参数只用于让浏览器缓存随尺寸变更而失效）。
 * 两者必须保持一致，改一处记得改另一处。
 */
const FAVICON_ASSET_SIZE = 128

function getDomainName(url: string) {
  let domain = url.replace(/(^\w+:|^)\/\//, '')
  domain = domain.replace(/^www\./, '')

  const matches = domain.match(/([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/)

  if (matches && matches.length > 1)
    return matches[1]

  return null
}

export function getFaviconUrl(url: string) {
  const paramsUrl = getDomainName(url)
  if (paramsUrl == null)
    return ''

  // 所有域名统一请求其自身 Favicon，不再用项目内置的通用图标覆盖真实站点图标。
  // 后端向上游请求 128x128 资源；前端按 --wallpaper-icon-size 渲染（默认 64 × 112% ≈ 71.7px，
  // 可调范围 40%~140%，即 25.6px ~ 89.6px），2 倍屏下最高需要 179 个设备像素。
  // 这样新增网站后每个站点都会使用自己域名的 Favicon，而不是共用默认图标。
  return `${FAVICON_API + paramsUrl}.png?size=${FAVICON_ASSET_SIZE}`
}
