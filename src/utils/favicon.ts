// 图标获取统一走本站 Pages Functions 代理（/favicon/{domain}.png），
// 由后端请求第三方源（DuckDuckGo / 0x3 / Google）并写入 KV 缓存，
// 避免浏览器直连第三方接口的跨域与稳定性问题。
const FAVICON_API = '/favicon/'
const FAVICON_ASSET_SIZE = 80

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
  // 后端向上游请求 80x80 资源，前端统一以 64x64 渲染。
  // 这样新增网站后每个站点都会使用自己域名的 Favicon，而不是共用默认图标。
  return `${FAVICON_API + paramsUrl}.png?size=${FAVICON_ASSET_SIZE}`
}
