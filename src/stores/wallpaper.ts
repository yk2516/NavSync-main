import type { WallpaperSettings } from '@/types'
import { readStore, writeStore } from '@/utils'
import { buildWallpaperUrl } from '@/utils/wallpaperSource'

const STORAGE_KEY_ADMIN = 'wallpaper_admin'
const STORAGE_KEY_VIEWER = 'wallpaper_viewer'

/** 图标基准尺寸：面板里 100% 对应 64px，与站点卡片原始尺寸一致 */
export const ICON_BASE_SIZE = 64

const SKINS: Record<string, { label: string; background: string }> = {
  // default 不设背景：交给 html 的主题底色（--bg-c / 暗色 --dark-bg-c），
  // 否则暗色模式下会被这里的亮色写死，且不透明背景会盖住壁纸层。
  default: { label: '默认', background: 'none' },
  deepBlue: { label: '沉静蓝', background: 'linear-gradient(135deg, #111827 0%, #1e293b 100%)' },
  polarGreen: { label: '极光青', background: 'linear-gradient(135deg, #0f2a2e 0%, #173b3b 100%)' },
  starPurple: { label: '星云紫', background: 'linear-gradient(135deg, #211a34 0%, #3b285f 100%)' },
  warmBrown: { label: '余烬棕', background: 'linear-gradient(135deg, #2c2019 0%, #4b2f1f 100%)' },
  midnight: { label: '午夜黑', background: 'linear-gradient(135deg, #090b12 0%, #202333 100%)' },
  ios: { label: 'iOS 屏半', background: 'linear-gradient(90deg, #f8fafc 0 50%, #17191f 50%)' },
  clear: { label: '干净明亮', background: 'linear-gradient(135deg, #ffffff 0%, #e8eef7 100%)' },
  material: { label: 'Material 粉', background: 'linear-gradient(135deg, #f8e9ee 0%, #ffffff 100%)' },
}

const DEFAULTS: WallpaperSettings = {
  skin: 'default',
  accent: '#0071e3',
  source: 'none',
  image: '',
  imageUrl: '',
  gradient: '',
  recentImages: [],
  glass: 'classic',
  wallpaperOpacity: 60,
  wallpaperBlur: 0,
  inputOpacity: 60,
  popupOpacity: 90,
  autoDim: true,
  // 图标默认「正圆 + 略大」：对齐 inftab 那类新标签页的观感（品牌图标撑满圆形、
  // 名称在下方小字）。想回到圆角方形把「图标形状」切一下即可。
  iconRadius: 50,
  iconOpacity: 100,
  iconSize: 112,
  imageSource: 'picsum',
  customSource: '',
  folderName: '',
  // 自定义布局默认值：2 行 × 5 列，间距各 30%（相对图标大小）
  layoutRows: 2,
  layoutCols: 5,
  layoutColGap: 30,
  layoutRowGap: 30,
  // 搜索框：宽度 / 圆角（透明度复用 inputOpacity）
  searchWidth: 560,
  searchRadius: 12,
}

function storageKey(isAdmin: boolean) {
  return isAdmin ? STORAGE_KEY_ADMIN : STORAGE_KEY_VIEWER
}

function loadSettings(isAdmin: boolean): WallpaperSettings {
  const raw = readStore(storageKey(isAdmin))
  if (!raw)
    return { ...DEFAULTS, recentImages: [] }

  try {
    const parsed = JSON.parse(raw) as Partial<WallpaperSettings>
    // 图标外观的旧默认值是「圆角方形 26% + 100% 大小」，已改为「正圆 50% + 112%」。
    // 只要两项都还停在旧默认值，就判定为「没手动调过」并迁移到新默认值；
    // 任一项被改过（哪怕是刻意调回 26%）都原样保留，不覆盖用户的显式选择。
    const legacyIconLook = parsed.iconRadius === 26 && parsed.iconSize === 100
    return {
      ...DEFAULTS,
      ...parsed,
      // 文件夹壁纸体积不可控，只留在内存里，刷新后由小风车重新抽取
      image: parsed.source === 'folder' ? '' : (parsed.image || ''),
      source: parsed.source === 'folder' ? 'none' : (parsed.source || 'none'),
      // 旧版本的「弹窗透明度」默认 40，但当时没有任何 CSS 消费它、从未生效。
      // 现在真正接上了，40% 不透明的弹窗读不清，迁移到新的可读默认值。
      popupOpacity: parsed.popupOpacity === 40 ? DEFAULTS.popupOpacity : (parsed.popupOpacity ?? DEFAULTS.popupOpacity),
      ...(legacyIconLook ? { iconRadius: DEFAULTS.iconRadius, iconSize: DEFAULTS.iconSize } : {}),
      recentImages: Array.isArray(parsed.recentImages) ? parsed.recentImages.slice(0, 4) : [],
      // 布局字段是后加的，旧数据里没有；即便有也可能是脏值，统一在这里夹到合法区间，
      // 否则 0 列 / NaN 会让网格塌成一条线，而面板滑块也会显示成怪值。
      layoutRows: clamp(parsed.layoutRows ?? DEFAULTS.layoutRows, 1, 6, DEFAULTS.layoutRows),
      layoutCols: clamp(parsed.layoutCols ?? DEFAULTS.layoutCols, 2, 8, DEFAULTS.layoutCols),
      layoutColGap: clamp(parsed.layoutColGap ?? DEFAULTS.layoutColGap, 0, 80, DEFAULTS.layoutColGap),
      layoutRowGap: clamp(parsed.layoutRowGap ?? DEFAULTS.layoutRowGap, 0, 80, DEFAULTS.layoutRowGap),
    }
  }
  catch {
    return { ...DEFAULTS, recentImages: [] }
  }
}

function safeUrl(url: string) {
  return url.replace(/"/g, '\\"').replace(/\n/g, '')
}

function clamp(value: number, min: number, max: number, fallback: number) {
  const n = Number(value)
  if (!Number.isFinite(n))
    return fallback
  return Math.max(min, Math.min(max, n))
}

// ---------- 壁纸明暗自适应 ----------
//
// 去掉内容区遮罩后，文字直接压在壁纸上：深色壁纸配深色文字等于看不见。
// 这里采样壁纸的平均亮度，给 html 打上 data-wallpaper-tone，由 CSS 翻转文字色。

type WallpaperTone = 'theme' | 'dark' | 'light'

function relativeLuminance(r: number, g: number, b: number) {
  const f = (v: number) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function parseColor(value: string): [number, number, number] | undefined {
  const hex = value.trim().match(/^#([0-9a-f]{3,8})$/i)
  if (hex) {
    let h = hex[1]
    if (h.length === 3)
      h = h.split('').map(c => c + c).join('')
    if (h.length < 6)
      return undefined
    return [Number.parseInt(h.slice(0, 2), 16), Number.parseInt(h.slice(2, 4), 16), Number.parseInt(h.slice(4, 6), 16)]
  }
  const rgb = value.match(/rgba?\(([^)]+)\)/i)
  if (rgb) {
    const parts = rgb[1].split(/[,/\s]+/).filter(Boolean).map(Number)
    if (parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite))
      return [parts[0], parts[1], parts[2]]
  }
  return undefined
}

/** 渐变壁纸：取所有色标的平均亮度 */
function gradientLuminance(gradient: string): number | undefined {
  const colors = gradient.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)/g)
  if (!colors?.length)
    return undefined
  let sum = 0
  let count = 0
  for (const color of colors) {
    const rgb = parseColor(color)
    if (!rgb)
      continue
    sum += relativeLuminance(...rgb)
    count++
  }
  return count ? sum / count : undefined
}

/** 图片壁纸：缩到 24x24 画布取平均亮度；跨域图片画布被污染时返回 undefined */
function imageLuminance(url: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const size = 24
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(undefined)
          return
        }
        ctx.drawImage(img, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)
        let sum = 0
        let weight = 0
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3] / 255
          if (alpha < 0.2)
            continue
          sum += relativeLuminance(data[i], data[i + 1], data[i + 2]) * alpha
          weight += alpha
        }
        resolve(weight ? sum / weight : undefined)
      }
      catch {
        // 跨域图片会污染画布，读不到像素
        resolve(undefined)
      }
    }
    img.onerror = () => resolve(undefined)
    img.src = url
  })
}

export const wallpaperSkins = SKINS

export const useWallpaperStore = defineStore('wallpaper', () => {
  const adminStore = useAdminStore()
  const settings = ref<WallpaperSettings>(loadSettings(adminStore.isAdmin))
  const panelVisible = ref(false)
  /** 已授权文件夹里的图片（内存态，不入 localStorage） */
  const folderImages = ref<{ name: string; url: string }[]>([])
  const folderBusy = ref(false)
  let skipPersist = false
  let lastToneKey = ''
  let toneToken = 0

  const isAdmin = computed(() => adminStore.isAdmin)

  function setTone(tone: WallpaperTone) {
    if (typeof document === 'undefined')
      return
    document.documentElement.dataset.wallpaperTone = tone
  }

  /**
   * 按当前壁纸更新文字色调。
   * 用 key 去重，避免拖滑块时每次都重新解码整张图。
   */
  function syncTone(image: string, gradient: string) {
    const autoDim = settings.value.autoDim
    const key = `${autoDim ? 'on' : 'off'}|${image ? `img:${image.length}:${image.slice(-48)}` : (gradient ? `g:${gradient}` : 'none')}`
    if (key === lastToneKey)
      return
    lastToneKey = key

    if (!autoDim) {
      setTone('theme')
      return
    }
    if (!image && !gradient) {
      setTone('theme')
      return
    }

    const token = ++toneToken
    if (image) {
      imageLuminance(image).then((lum) => {
        if (token !== toneToken)
          return
        // 读不到像素（跨域污染）时按深色处理：浅色文字 + 投影在两种底上都能看
        setTone(lum === undefined ? 'dark' : (lum < 0.42 ? 'dark' : 'light'))
      })
      return
    }

    const lum = gradientLuminance(gradient)
    setTone(lum === undefined ? 'dark' : (lum < 0.42 ? 'dark' : 'light'))
  }

  function persist() {
    if (skipPersist)
      return
    const snapshot = { ...settings.value }
    // 文件夹壁纸是 objectURL，刷新即失效，持久化没有意义还会写爆配额
    if (snapshot.source === 'folder')
      snapshot.image = ''
    // 图片超出 localStorage 配额：当前会话仍可用，但刷新后会丢失。
    // 不阻断页面，只留一条线索便于排查。
    if (!writeStore(storageKey(isAdmin.value), JSON.stringify(snapshot)))
      console.warn('[wallpaper] 壁纸保存失败，可能图片过大超出 localStorage 配额')
  }

  function apply() {
    if (typeof document === 'undefined')
      return

    const root = document.documentElement
    const body = document.body
    const current = settings.value
    const skin = SKINS[current.skin] || SKINS.default
    let image = ''
    if (current.source === 'local' && current.image)
      image = current.image
    else if (current.source === 'folder' && current.image)
      image = current.image
    else if (current.source === 'url' && current.imageUrl)
      image = current.imageUrl
    else if (current.source === 'source' && current.imageUrl)
      image = current.imageUrl

    root.style.setProperty('--wallpaper-skin', skin.background)
    root.style.setProperty('--wallpaper-accent', current.accent || '#0071e3')
    root.style.setProperty('--wallpaper-opacity', String(clamp(current.wallpaperOpacity, 0, 100, 60) / 100))
    root.style.setProperty('--wallpaper-blur', `${clamp(current.wallpaperBlur, 0, 32, 0)}px`)
    root.style.setProperty('--wallpaper-input-opacity', String(clamp(current.inputOpacity, 0, 100, 60) / 100))
    root.style.setProperty('--wallpaper-popup-opacity', String(clamp(current.popupOpacity, 0, 100, 90) / 100))
    root.style.setProperty('--wallpaper-image', image ? `url("${safeUrl(image)}")` : 'none')
    root.style.setProperty('--wallpaper-gradient', current.gradient || 'none')
    // 图标外观（站点卡片）
    root.style.setProperty('--wallpaper-icon-radius', `${clamp(current.iconRadius, 0, 50, DEFAULTS.iconRadius)}%`)
    root.style.setProperty('--wallpaper-icon-opacity', String(clamp(current.iconOpacity, 10, 100, 100) / 100))
    root.style.setProperty('--wallpaper-icon-size', `${(ICON_BASE_SIZE * clamp(current.iconSize, 40, 140, DEFAULTS.iconSize) / 100).toFixed(1)}px`)
    root.style.setProperty('--wallpaper-search-width', `${clamp(current.searchWidth, 260, 900, DEFAULTS.searchWidth)}px`)
    root.style.setProperty('--wallpaper-search-radius', `${clamp(current.searchRadius, 0, 28, DEFAULTS.searchRadius)}px`)
    // 自定义布局：行数/列数/间距。间距用「图标大小 × 百分比」换算，
    // 这样调大图标时间距会一起放大，不会出现「图标很大但挤在一起」。
    const rows = Math.round(clamp(current.layoutRows, 1, 6, DEFAULTS.layoutRows))
    const cols = Math.round(clamp(current.layoutCols, 2, 8, DEFAULTS.layoutCols))
    const colGap = clamp(current.layoutColGap, 0, 80, DEFAULTS.layoutColGap)
    const rowGap = clamp(current.layoutRowGap, 0, 80, DEFAULTS.layoutRowGap)
    root.style.setProperty('--layout-rows', String(rows))
    root.style.setProperty('--layout-cols', String(cols))
    root.style.setProperty('--layout-col-gap', `calc(var(--wallpaper-icon-size) * ${(colGap / 100).toFixed(2)})`)
    root.style.setProperty('--layout-row-gap', `calc(var(--wallpaper-icon-size) * ${(rowGap / 100).toFixed(2)})`)
    root.dataset.wallpaperGlass = current.glass
    root.dataset.wallpaperSource = current.source
    root.dataset.wallpaperAutoDim = current.autoDim ? 'true' : 'false'
    body.style.setProperty('--primary-c', current.accent || '')
    syncTone(image, current.source === 'gradient' ? current.gradient : '')
  }

  function update(patch: Partial<WallpaperSettings>) {
    Object.assign(settings.value, patch)
    persist()
    apply()
  }

  function setSkin(skin: string) {
    update({ skin, source: 'none', image: '', imageUrl: '', gradient: '' })
  }

  function setImage(image: string, source: 'local' | 'url' = 'local') {
    update({ source, image: source === 'local' ? image : '', imageUrl: source === 'url' ? image : '', gradient: '' })
    if (image && source === 'local') {
      const recentImages = [image, ...settings.value.recentImages.filter(item => item !== image)].slice(0, 4)
      update({ recentImages })
    }
  }

  function setGradient(gradient: string) {
    update({ source: 'gradient', gradient, image: '', imageUrl: '' })
  }

  function removeWallpaper() {
    update({ source: 'none', image: '', imageUrl: '', gradient: '' })
  }

  function reset() {
    settings.value = { ...DEFAULTS, recentImages: [] }
    persist()
    apply()
  }

  // ---------- 文件夹壁纸 ----------

  /** 释放旧的 objectURL，避免反复选文件夹时内存泄漏 */
  function releaseFolderImages() {
    folderImages.value.forEach(item => URL.revokeObjectURL(item.url))
    folderImages.value = []
  }

  function setFolderImages(files: File[], folderName: string) {
    releaseFolderImages()
    folderImages.value = files.map(file => ({ name: file.name, url: URL.createObjectURL(file) }))
    update({ folderName })
  }

  function pickFolderImage(): string {
    if (!folderImages.value.length)
      return ''
    const item = folderImages.value[Math.floor(Math.random() * folderImages.value.length)]
    return item.url
  }

  function useFolderImage() {
    const url = pickFolderImage()
    if (!url)
      return false
    update({ source: 'folder', image: url, imageUrl: '', gradient: '' })
    return true
  }

  // ---------- 壁纸源网站 ----------

  function useSourceWallpaper() {
    const url = buildWallpaperUrl(settings.value.imageSource, settings.value.customSource)
    if (!url)
      return false
    update({ source: 'source', imageUrl: url, image: '', gradient: '' })
    return true
  }

  /**
   * 小风车：点一下换一张壁纸。
   * 优先从已授权的文件夹里抽，其次从选定的壁纸源拉。
   */
  function shuffleWallpaper() {
    if (folderImages.value.length && useFolderImage())
      return 'folder'
    if (useSourceWallpaper())
      return 'source'
    return 'none'
  }

  function openPanel() {
    panelVisible.value = true
  }

  function closePanel() {
    panelVisible.value = false
  }

  watch(isAdmin, (value) => {
    skipPersist = true
    settings.value = loadSettings(value)
    nextTick(() => {
      skipPersist = false
      apply()
    })
  })

  watch(settings, () => {
    persist()
    apply()
  }, { deep: true })

  apply()

  return {
    settings,
    panelVisible,
    isAdmin,
    folderImages,
    folderBusy,
    update,
    // 供 App.vue 在启动时把壁纸变量注入 DOM；此前遗漏导出会导致 setup 抛错、整页白屏
    apply,
    setSkin,
    setImage,
    setGradient,
    removeWallpaper,
    reset,
    openPanel,
    closePanel,
    setFolderImages,
    releaseFolderImages,
    useFolderImage,
    useSourceWallpaper,
    shuffleWallpaper,
  }
})
