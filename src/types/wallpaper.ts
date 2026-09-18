export type WallpaperSource = 'none' | 'local' | 'url' | 'gradient' | 'folder' | 'source'
export type GlassEffect = 'classic' | 'liquid'

export interface WallpaperSettings {
  skin: string
  accent: string
  source: WallpaperSource
  image: string
  imageUrl: string
  gradient: string
  recentImages: string[]
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
  /** 壁纸源网站 id */
  imageSource: string
  /** 自定义壁纸源 URL 模板，支持 {w} {h} {r} 占位符 */
  customSource: string
  /** 已授权的壁纸文件夹名（仅用于展示，句柄存在 IndexedDB） */
  folderName: string
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

export interface WallpaperSourceItem {
  id: string
  label: string
  hint?: string
  /** 生成一次随机壁纸地址；r 为随机种子 */
  build: (width: number, height: number, r: number) => string
}
