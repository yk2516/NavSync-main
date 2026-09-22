/**
 * 壁纸来源。
 *
 * ⚠️ 只有这三种：本地图片 / 壁纸文件夹 / 壁纸源网站（Picsum、必应…）已于 2026-09-20
 * 按用户要求**整块移除** —— 它们的「下载 + 解码」注定做不到秒开，而皮肤与渐变是纯 CSS。
 * 图片壁纸仍可通过 `url` 贴外链。
 */
export type WallpaperSource = 'none' | 'url' | 'gradient'
export type GlassEffect = 'classic' | 'liquid'
/** 站点图标来源：网站默认 favicon、第三方服务，或本地合成纯色字母图标 */
export type FaviconSource = 'site' | 'google' | 'duckduckgo' | 'solid'

export interface WallpaperSettings {
  skin: string
  accent: string
  /** 全局站点图标来源；每个设备独立保存，访客与站长分别保存 */
  faviconSource: FaviconSource
  source: WallpaperSource
  imageUrl: string
  gradient: string
  glass: GlassEffect
  wallpaperOpacity: number
  wallpaperBlur: number
  inputOpacity: number
  popupOpacity: number
  autoDim: boolean
  /** 图标圆角（%） */
  iconRadius: number
  /** 图标不透明度（%） */
  iconOpacity: number
  /** 图标大小（%，100 表示 64px） */
  iconSize: number
  /**
   * 图标四周留白（%，相对图标盒子大小）。
   *
   * 为什么要它：图标源（0x3 / 站点 favicon.ico）主流只给 32×32，
   * 而默认图标盒有 ~72px —— 图标铺满整盒时等于把 32px 的图放大 2 倍多，
   * 再顶到圆角边上，观感「大而糊」。留一圈白让绘制区回落到接近原生尺寸，
   * 同一张图立刻显得锐利、精致（参照 muiui 那类导航页的做法：45px 盒 + 8px 内缩）。
   */
  iconPadding: number
  /** 自定义布局：每页行数 */
  layoutRows: number
  /** 自定义布局：每页列数 */
  layoutCols: number
  /** 自定义布局：列间距（%，相对图标大小） */
  layoutColGap: number
  /** 自定义布局：行间距（%，相对图标大小） */
  layoutRowGap: number
  /** 搜索框宽度（px） */
  searchWidth: number
  /** 搜索框圆角（px） */
  searchRadius: number
}
