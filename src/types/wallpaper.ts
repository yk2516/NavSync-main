export type WallpaperSource = 'none' | 'local' | 'url' | 'gradient'
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
  sidebarOpacity: number
  inputOpacity: number
  popupOpacity: number
  autoDim: boolean
}
