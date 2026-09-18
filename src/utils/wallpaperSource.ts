import type { WallpaperSourceItem } from '@/types'

/**
 * 壁纸源网站：都是浏览器可直连的公开图片接口，无需后端代理。
 * 每次调用 build() 会带上新的随机种子，因此「小风车」一点就能换一张。
 */
export const WALLPAPER_SOURCES: WallpaperSourceItem[] = [
  {
    id: 'picsum',
    label: 'Picsum 随机',
    hint: '免费随机高清图库，稳定无需密钥',
    build: (w, h, r) => `https://picsum.photos/${w}/${h}?random=${r}`,
  },
  {
    id: 'picsum-gray',
    label: 'Picsum 灰度',
    hint: '灰度随机图，配文字更清晰',
    build: (w, h, r) => `https://picsum.photos/${w}/${h}?grayscale&random=${r}`,
  },
  {
    id: 'bing',
    label: '必应每日一图',
    hint: '必应首页当天壁纸',
    build: () => `https://bing.img.run/1920x1080.php?t=${Date.now()}`,
  },
  {
    id: 'bing-random',
    label: '必应随机图',
    hint: '从必应历史壁纸中随机取一张',
    build: () => `https://bing.img.run/rand.php?t=${Date.now()}`,
  },
  {
    id: 'custom',
    label: '自定义地址',
    hint: '支持 {w} {h} {r} 占位符',
    build: () => '',
  },
]

export function getWallpaperSource(id: string) {
  return WALLPAPER_SOURCES.find(item => item.id === id) || WALLPAPER_SOURCES[0]
}

/**
 * 生成一张壁纸地址。r 为随机种子（每次点小风车换一个）。
 * 宽高取当前视口，避免下载远超屏幕的大图。
 */
export function buildWallpaperUrl(sourceId: string, customTemplate: string, seed = Math.floor(Math.random() * 1e9)) {
  const width = Math.max(1280, Math.min(2560, Math.round((typeof window !== 'undefined' ? window.innerWidth : 1920) * 1.2)))
  const height = Math.max(720, Math.min(1600, Math.round((typeof window !== 'undefined' ? window.innerHeight : 1080) * 1.2)))

  if (sourceId === 'custom') {
    const template = customTemplate.trim()
    if (!template)
      return ''
    return template
      .replace(/\{w\}/g, String(width))
      .replace(/\{h\}/g, String(height))
      .replace(/\{r\}/g, String(seed))
  }

  return getWallpaperSource(sourceId).build(width, height, seed)
}
