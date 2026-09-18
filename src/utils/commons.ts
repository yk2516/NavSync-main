export function getRandomDarkColor() {
  const ranges = [64, 128, 256]
  const rRange = ranges[Math.floor(Math.random() * ranges.length)]
  const gRange = ranges[Math.floor(Math.random() * ranges.length)]
  const bRange = ranges[Math.floor(Math.random() * ranges.length)]
  const r = Math.floor(Math.random() * rRange).toString(16).padStart(2, '0')
  const g = Math.floor(Math.random() * (gRange === 256 ? gRange * 0.8 : gRange)).toString(16).padStart(2, '0')
  const b = Math.floor(Math.random() * bRange).toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}

/** 生成 0~1 之间的随机数（用于组件 key 刷新等场景） */
export function getRandomComplexNumber(): number {
  return Math.random() || (Date.now() / 1e13)
}

/**
 * 规范化站点链接：**只放行 http / https**，其余协议一律返回空串。
 *
 * 为什么必须在渲染前过滤：站点数据的来源有三个 —— 本地缓存、云端 Gist、
 * **导入的 JSON 文件**。导入路径（`MainSetting.vue` 的 `importData`）只校验了
 * `Array.isArray(data.data)`，不检查字段内容，所以一份第三方「导航配置包」
 * 就能把 `javascript:...` 塞进 `site.url`。浏览态点击站点卡片会直接导航，
 * `javascript:` 于是**在本站 origin 执行**，而本站 `localStorage` 里存着明文的
 * `cloud_password`（`utils/cloud.ts`）—— 攻击者拿到口令就能改写站长的云端配置。
 *
 * 顺带修一个老问题：省略协议头的输入（`example.com`）会被浏览器当成相对路径
 * 打开（`/example.com`），这里补成 `https://`。
 *
 * @returns 可安全写入 `href` 的地址；返回空串表示不可点
 */
export function safeSiteUrl(url?: string | null): string {
  const raw = (url || '').trim()
  if (!raw)
    return ''

  // 形如 `javascript:` / `data:` 的带协议输入原样保留交给下一步判定；
  // 没有协议头的（含 `//evil.com` 这种）补上 https，并吃掉多余的前导斜杠
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw)
    ? raw
    : `https://${raw.replace(/^\/+/, '')}`

  try {
    const { protocol } = new URL(candidate)
    return (protocol === 'http:' || protocol === 'https:') ? candidate : ''
  }
  catch {
    return ''
  }
}

/**
 * 规范化站点图标地址：只放行 http / https 与**本站同域相对路径**（`/favicon/...`）。
 *
 * 和 `safeSiteUrl` 的区别在于危害等级：favicon 绑在 `<img :src>` 上，
 * `javascript:` 不会执行，所以它不是脚本注入面。但**未过滤的远程地址是一个追踪信标** ——
 * 导入一份第三方「导航配置包」再打开首页，就会把访客的 IP / UA / 时间戳
 * 一并送给对方（配置包里塞几十个不同域名的图标还能顺便数出「谁在用」）。
 * `data:` 另有大 payload 拖慢渲染的问题。
 *
 * 放行相对路径是因为项目自身的图标走同域的 `/favicon/{domain}.png`。
 *
 * @returns 可安全写入 `src` 的地址；返回空串表示不可用，调用方应回退到自动获取
 */
export function safeFaviconUrl(url?: string | null): string {
  const raw = (url || '').trim()
  if (!raw)
    return ''

  // 本站同域相对路径（`//host/x` 是协议相对地址，不是同域路径，交给下面的判定）
  if (raw.startsWith('/') && !raw.startsWith('//'))
    return raw

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
  try {
    const { protocol } = new URL(candidate)
    return (protocol === 'http:' || protocol === 'https:') ? candidate : ''
  }
  catch {
    return ''
  }
}
