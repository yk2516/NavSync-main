import type { SiteLayout, WallpaperSettings } from '@/types'
import { readStore, writeStore } from '@/utils'

const STORAGE_KEY_ADMIN = 'wallpaper_admin'
const STORAGE_KEY_VIEWER = 'wallpaper_viewer'

/** 图标基准尺寸：面板里 100% 对应 64px，与站点卡片原始尺寸一致 */
export const ICON_BASE_SIZE = 64

/**
 * 紧凑列表的图标 = 全局图标大小 × 这个比例（下限见 COMPACT_ICON_MIN）。
 *
 * 2026-09-28 由 0.32 提到 0.6：紧凑列表从「小图标 + 横排文字」改成「图标在上、
 * 名称在下」的纵排网格后，图标成了条目的主视觉 —— 22.9px 的小图标在纵排里
 * 又空又糊，跟参考设计对不上。默认 112% → 71.7px × 0.6 ≈ 43px，
 * 在 104px 宽的格子里约占三成，与参考设计的比例一致。
 */
export const COMPACT_ICON_RATIO = 0.6
/** 紧凑列表图标的下限（px）：再小就认不出是什么站了 */
export const COMPACT_ICON_MIN = 16

/**
 * 设置写盘的合并窗口（ms）。
 * 拖滑块会每帧触发一次改动，而 localStorage 是同步写、且设置里可能躺着 1~2MB 的 base64，
 * 不合并的话拖动会直接卡住。窗口内的改动合并成一次写入，关页面前由 `beforeunload` 兜底落盘。
 */
const PERSIST_DEBOUNCE_MS = 300

/**
 * 预设皮肤已整块移除（2026-09-30，用户明确要求）：
 * 面板不再有「皮肤」分区，壁纸只剩「高级壁纸」里的渐变 / 图片链接。
 * 旧的 `skin` 设置字段走 loadSettings 白名单被丢弃，并列入 LEGACY 清理。
 * html 底色从此只有主题色；`--wallpaper-skin` 变量不再写入，
 * public.scss 里的 `var(--wallpaper-skin, none)` 走 none 兜底。
 */

/**
 * 渐变壁纸预设：一键可用的现成配色，给「高级壁纸 → 渐变」当选项用。
 *
 * 渐变写在 body::after（图片之上，直接当壁纸用），纯 CSS、零请求。
 * 原来的「强对比」分组已随皮肤一起按用户要求移除（2026-09-30），
 * 只保留「清新柔和」：低饱和、明度在翻转线之上，导航页长时间停留不累。
 * `group` 只影响面板分组，不参与渲染。
 */
export const WALLPAPER_GRADIENTS: { label: string; group: string; value: string }[] = [
  { label: '晨雾', group: '清新柔和', value: 'linear-gradient(160deg, #dbe7f3 0%, #cddcee 50%, #ecdff2 100%)' },
  { label: '月白', group: '清新柔和', value: 'linear-gradient(160deg, #e8eef7 0%, #d5dfec 100%)' },
  { label: '海盐', group: '清新柔和', value: 'linear-gradient(150deg, #8fe3e0 0%, #cfe0f7 100%)' },
  { label: '薄荷奶', group: '清新柔和', value: 'linear-gradient(150deg, #bdeee0 0%, #c8e6fb 100%)' },
  { label: '抹茶奶', group: '清新柔和', value: 'linear-gradient(150deg, #cfe9b8 0%, #f2ecc4 100%)' },
  { label: '天青', group: '清新柔和', value: 'linear-gradient(150deg, #b8ddfb 0%, #d7ecff 100%)' },
  { label: '竹影', group: '清新柔和', value: 'linear-gradient(150deg, #bfe6c8 0%, #b6dcdd 100%)' },
  { label: '青瓷', group: '清新柔和', value: 'linear-gradient(150deg, #b6e3d8 0%, #a5d2cf 50%, #dcebe6 100%)' },
  { label: '樱雪', group: '清新柔和', value: 'linear-gradient(150deg, #ffd9e4 0%, #f2c9dd 55%, #d9d2f7 100%)' },
  { label: '藕荷', group: '清新柔和', value: 'linear-gradient(150deg, #e6cff0 0%, #cdc6f2 50%, #dde6fa 100%)' },
  { label: '香芋', group: '清新柔和', value: 'linear-gradient(150deg, #cfb9f7 0%, #f0c8ee 100%)' },
  { label: '米杏', group: '清新柔和', value: 'linear-gradient(150deg, #fbe3c4 0%, #eed3b3 100%)' },
  { label: '沙丘', group: '清新柔和', value: 'linear-gradient(150deg, #f4e3c8 0%, #e6d7c3 50%, #d3dae4 100%)' },
  { label: '薄暮', group: '清新柔和', value: 'linear-gradient(150deg, #f7d7b8 0%, #dcc2e0 50%, #b9c8ea 100%)' },
]

const DEFAULTS: WallpaperSettings = {
  accent: '#0071e3',
  // 新默认遵循网站自身标准位置；用户可在「高级壁纸」右侧切换第三方源或纯色图标。
  faviconSource: 'site',
  source: 'none',
  imageUrl: '',
  gradient: '',
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
  // 图标四周留一圈白（12%）：图标源主流只给 32×32，铺满 ~72px 的盒子等于把图放大
  // 两倍多再顶到圆角边上，观感「大而糊」。留白让绘制区回落到接近原生尺寸，
  // 同一张图立刻显得锐利 —— 参照 muiui 那类导航页（45px 盒 + 8px 内缩）。
  iconPadding: 12,
  // 浏览态默认走「紧凑列表」：分组纵向铺开、图标在上名称在下 —— 一屏能看到几十个站点，
  // 比「一页十个大图标 + 翻页」更接近主流导航页的用法。想回到图标网格在面板里切一下即可。
  siteLayout: 'compact',
  // 自定义布局默认值：2 行 × 5 列，间距各 30%（相对图标大小）
  layoutRows: 2,
  layoutCols: 5,
  layoutColGap: 30,
  layoutRowGap: 30,
  // 搜索框：宽度 / 高度 / 圆角（透明度复用 inputOpacity）
  searchWidth: 560,
  searchHeight: 46,
  searchRadius: 12,
}

function storageKey(isAdmin: boolean) {
  return isAdmin ? STORAGE_KEY_ADMIN : STORAGE_KEY_VIEWER
}

/**
 * 已下线能力在 localStorage 里留下的字段。
 *
 * 「本地图片」存的是 base64（单张可达几百 KB，`recentImages` 还留 4 张）、
 * 壁纸文件夹名、壁纸源 id —— 这些都不再被读取，但会**一直占着 localStorage 配额**
 * （5MB 级别，且是同源共享）。`loadSettings()` 只在内存里把它们折掉、不写回，
 * 所以需要单独清一次。
 */
const LEGACY_WALLPAPER_KEYS = ['image', 'recentImages', 'imageSource', 'customSource', 'folderName', 'skin']

/**
 * 把存储里的旧字段清掉（重写为迁移后的干净设置）。
 *
 * 只在**确实存在**这些键时才写盘 —— 否则每次启动都会多一次同步写。
 * 返回是否真的写了，便于测试断言。
 */
function purgeLegacyKeys(isAdmin: boolean) {
  const raw = readStore(storageKey(isAdmin))
  if (!raw)
    return false
  if (!LEGACY_WALLPAPER_KEYS.some(key => raw.includes(`"${key}":`)))
    return false
  // 重新走一遍 loadSettings，写回去的一定是清洗过的值（不直接改 raw）
  writeStore(storageKey(isAdmin), JSON.stringify(loadSettings(isAdmin)))
  return true
}

function loadSettings(isAdmin: boolean): WallpaperSettings {
  const raw = readStore(storageKey(isAdmin))
  if (!raw)
    return { ...DEFAULTS }

  try {
    const parsed = JSON.parse(raw) as Partial<WallpaperSettings> & Record<string, unknown>
    // 图标外观的旧默认值是「圆角方形 26% + 100% 大小」，已改为「正圆 50% + 112%」。
    // 只要两项都还停在旧默认值，就判定为「没手动调过」并迁移到新默认值；
    // 任一项被改过（哪怕是刻意调回 26%）都原样保留，不覆盖用户的显式选择。
    const legacyIconLook = parsed.iconRadius === 26 && parsed.iconSize === 100
    // 本地图片 / 壁纸文件夹 / 壁纸源网站已下线，旧设置里可能还存着这些来源：
    // 统一折回 none，否则会渲染出一个取不到图的黑屏。
    const source = (parsed.source === 'url' || parsed.source === 'gradient') ? parsed.source : 'none'
    const faviconSource = (parsed.faviconSource === 'site'
      || parsed.faviconSource === 'google'
      || parsed.faviconSource === 'duckduckgo'
      || parsed.faviconSource === 'solid')
      ? parsed.faviconSource
      : DEFAULTS.faviconSource
    // 后加的字段：旧数据里没有 → 落到新的默认值（紧凑列表）。
    // 脏值（拼错、null、数字）同样折回默认，不让它决定渲染哪个视图。
    const siteLayout: SiteLayout = (parsed.siteLayout === 'grid' || parsed.siteLayout === 'compact')
      ? parsed.siteLayout
      : DEFAULTS.siteLayout

    // ⚠️ 这里**逐字段白名单**构造，绝不写 `{ ...DEFAULTS, ...parsed }`.
    //
    // `parsed` 是**用户存储里的原始对象**，里面可能躺着已下线能力的字段：
    // 本地图片的 base64（`image` 单张可达几百 KB、`recentImages` 还留 4 张）、
    // 壁纸文件夹名、壁纸源 id。展开它 = 这些字段会跟着 settings 一起被写回
    // localStorage，于是每次 persist 都要同步序列化 1~2MB —— 正是 2026-09-20
    // 那轮「写盘防抖」要修掉的开销，等于白修。
    // 未知键一律丢弃（与 `stores/setting.ts` 的 `pickKnownSettings()` 同一原则）。
    return {
      accent: typeof parsed.accent === 'string' ? parsed.accent : DEFAULTS.accent,
      faviconSource,
      source,
      imageUrl: (source === 'url' && typeof parsed.imageUrl === 'string') ? parsed.imageUrl : '',
      gradient: (source === 'gradient' && typeof parsed.gradient === 'string') ? parsed.gradient : '',
      glass: parsed.glass === 'liquid' ? 'liquid' : DEFAULTS.glass,
      wallpaperOpacity: clamp(parsed.wallpaperOpacity, 0, 100, DEFAULTS.wallpaperOpacity),
      wallpaperBlur: clamp(parsed.wallpaperBlur, 0, 32, DEFAULTS.wallpaperBlur),
      inputOpacity: clamp(parsed.inputOpacity, 0, 100, DEFAULTS.inputOpacity),
      // 旧版本的「弹窗透明度」默认 40，但当时没有任何 CSS 消费它、从未生效。
      // 现在真正接上了，40% 不透明的弹窗读不清，迁移到新的可读默认值。
      popupOpacity: parsed.popupOpacity === 40
        ? DEFAULTS.popupOpacity
        : clamp(parsed.popupOpacity, 0, 100, DEFAULTS.popupOpacity),
      autoDim: typeof parsed.autoDim === 'boolean' ? parsed.autoDim : DEFAULTS.autoDim,
      iconRadius: clamp(legacyIconLook ? DEFAULTS.iconRadius : parsed.iconRadius,
        0, 50, DEFAULTS.iconRadius),
      iconOpacity: clamp(parsed.iconOpacity, 10, 100, DEFAULTS.iconOpacity),
      iconSize: clamp(legacyIconLook ? DEFAULTS.iconSize : parsed.iconSize,
        40, 140, DEFAULTS.iconSize),
      // 后加的字段，旧数据里没有 → clamp 会走 fallback（= 新的默认留白）。
      iconPadding: clamp(parsed.iconPadding, 0, 30, DEFAULTS.iconPadding),
      siteLayout,
      // 布局字段是后加的，旧数据里没有；即便有也可能是脏值，统一在这里夹到合法区间，
      // 否则 0 列 / NaN 会让网格塌成一条线，而面板滑块也会显示成怪值。
      layoutRows: clamp(parsed.layoutRows, 1, 6, DEFAULTS.layoutRows),
      layoutCols: clamp(parsed.layoutCols, 2, 8, DEFAULTS.layoutCols),
      layoutColGap: clamp(parsed.layoutColGap, 0, 80, DEFAULTS.layoutColGap),
      layoutRowGap: clamp(parsed.layoutRowGap, 0, 80, DEFAULTS.layoutRowGap),
      searchWidth: clamp(parsed.searchWidth, 260, 900, DEFAULTS.searchWidth),
      searchHeight: clamp(parsed.searchHeight, 36, 80, DEFAULTS.searchHeight),
      searchRadius: clamp(parsed.searchRadius, 0, 28, DEFAULTS.searchRadius),
    }
  }
  catch {
    return { ...DEFAULTS }
  }
}

function safeUrl(url: string) {
  return url.replace(/"/g, '\\"').replace(/\n/g, '')
}

/**
 * 把外部来的数值夹到合法区间。
 * `value` 故意声明成 `unknown`：调用方传进来的往往是「用户存储里读出来的值」，
 * 可能是 undefined / 字符串 / NaN，用 `number` 会逼着调用方到处写断言。
 */
function clamp(value: unknown, min: number, max: number, fallback: number) {
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

export const useWallpaperStore = defineStore('wallpaper', () => {
  const adminStore = useAdminStore()
  const settings = ref<WallpaperSettings>(loadSettings(adminStore.isAdmin))
  const panelVisible = ref(false)
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
   * 优先级：图片 > 渐变壁纸 —— 按 z-index 从上到下，以最上面那层为准。
   * 用 key 去重，避免拖滑块时每次都重新解码整张图。
   */
  function syncTone(image: string, gradient: string) {
    const autoDim = settings.value.autoDim
    const surface = image
      ? `img:${image.length}:${image.slice(-48)}`
      : (gradient ? `g:${gradient}` : 'none')
    const key = `${autoDim ? 'on' : 'off'}|${surface}`
    if (key === lastToneKey)
      return
    lastToneKey = key

    if (!autoDim || surface === 'none') {
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

    const lum = gradientLuminance(gradient || skin)
    setTone(lum === undefined ? 'dark' : (lum < 0.42 ? 'dark' : 'light'))
  }

  function persist() {
    if (skipPersist)
      return
    // 图片超出 localStorage 配额：当前会话仍可用，但刷新后会丢失。
    // 不阻断页面，只留一条线索便于排查。
    if (!writeStore(storageKey(isAdmin.value), JSON.stringify(settings.value)))
      console.warn('[wallpaper] 壁纸保存失败，可能图片过大超出 localStorage 配额')
  }

  // 拖滑块会以每帧一次的速度改动 settings，而 persist 是同步写 localStorage
  // （URL 壁纸的地址可能很长），必须合并写入，否则拖动直接卡住。
  let persistTimer: ReturnType<typeof setTimeout> | undefined

  function schedulePersist() {
    if (persistTimer)
      clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      persistTimer = undefined
      persist()
    }, PERSIST_DEBOUNCE_MS)
  }

  /** 把待写的设置立刻落盘（关页面前调用，避免防抖窗口内的改动丢失） */
  function flushPersist() {
    if (!persistTimer)
      return
    clearTimeout(persistTimer)
    persistTimer = undefined
    persist()
  }

  function apply() {
    if (typeof document === 'undefined')
      return

    const root = document.documentElement
    const body = document.body
    const current = settings.value
    // 本地图片 / 文件夹 / 壁纸源 / 皮肤均已下线，图片只可能来自外链 URL
    const image = current.source === 'url' ? current.imageUrl : ''

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
    const iconPx = ICON_BASE_SIZE * clamp(current.iconSize, 40, 140, DEFAULTS.iconSize) / 100
    root.style.setProperty('--wallpaper-icon-size', `${iconPx.toFixed(1)}px`)
    // 留白按「图标盒 × 百分比」换算成像素：图标调大时留白跟着放大，比例不变。
    const paddingPct = clamp(current.iconPadding, 0, 30, DEFAULTS.iconPadding)
    root.style.setProperty('--wallpaper-icon-padding', `${(iconPx * paddingPct / 100).toFixed(1)}px`)
    // 紧凑列表的图标：由「图标大小」按比例缩小（默认 112% → 71.7px → 43px），
    // 而不是写死一个像素值 —— 站长拖「图标大小」时两种视图一起变大变小，控件不会变成死的。
    // 下限 16px：再小图标就糊成一团，看不清是什么站。
    const compactIconPx = Math.max(COMPACT_ICON_MIN, iconPx * COMPACT_ICON_RATIO)
    root.style.setProperty('--compact-icon-size', `${compactIconPx.toFixed(1)}px`)
    root.style.setProperty('--compact-icon-padding', `${(compactIconPx * paddingPct / 100).toFixed(1)}px`)
    root.style.setProperty('--wallpaper-search-width', `${clamp(current.searchWidth, 260, 900, DEFAULTS.searchWidth)}px`)
    root.style.setProperty('--wallpaper-search-height', `${clamp(current.searchHeight, 36, 80, DEFAULTS.searchHeight)}px`)
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
    // 浏览态渲染哪套视图由组件自己判断，这里同步一份到 DOM 上：
    // 验收脚本（和排查问题的人）可以直接从 html 上读到当前样式，不用去翻 localStorage。
    root.dataset.siteLayout = current.siteLayout
    body.style.setProperty('--primary-c', current.accent || '')
    // 只有图片/渐变参与明暗判定（皮肤已移除，html 底色就是主题色，永远「浅底深字」成立）
    syncTone(
      image,
      current.source === 'gradient' ? current.gradient : '',
    )
  }

  /**
   * 唯一的写入口：只改状态，持久化与渲染统一交给下面的 deep watch。
   *
   * 之前这里还各自调了一遍 `persist()` / `apply()`，而 deep watch 里也有一遍 ——
   * 每次改动等于**写两遍 localStorage**。壁纸设置里可能躺着 1~2MB 的 base64 图片，
   * 而 localStorage 是同步 API，这个开销直接落在主线程上（拖滑块时每帧一次，卡成幻灯片）。
   *
   * 面板里的滑块是 `v-model.number="settings.xxx"` 直接绑到 settings 上的、不走这里，
   * 所以持久化**不能**只挂在这个函数上，必须留在 deep watch 里。
   */
  function update(patch: Partial<WallpaperSettings>) {
    Object.assign(settings.value, patch)
  }

  function setImageUrl(imageUrl: string) {
    update({ source: 'url', imageUrl, gradient: '' })
  }

  function setGradient(gradient: string) {
    update({ source: 'gradient', gradient, imageUrl: '' })
  }

  function removeWallpaper() {
    update({ source: 'none', imageUrl: '', gradient: '' })
  }

  function reset() {
    settings.value = { ...DEFAULTS }
    persist()
    apply()
  }

  // ---------- 小风车：随机换皮肤 / 渐变 ----------

  /**
   * 从列表里随机挑一个**与当前不同**的项。
   *
   * 写成「先过滤掉当前项、再随机」而不是「随机后 while 重抽」：
   * 后者在列表只剩 1 项时会死循环，而这里是 O(n) 且不可能卡住。
   */
  function pickDifferent<T>(list: T[], current: T): T | undefined {
    if (!list.length)
      return undefined
    if (list.length === 1)
      return list[0]
    const others = list.filter(item => item !== current)
    return others[Math.floor(Math.random() * others.length)]
  }

  /**
   * 小风车：随机换一套渐变壁纸，返回换了没有。
   *
   * 皮肤已整块移除（2026-09-30），壁纸只剩「渐变 / 图片链接 / 无」，
   * 渐变是纯 CSS —— 零请求、零解码，点下去下一帧就变，这才是「秒开」的做法。
   * 图片链接是用户手贴的外链、没有预设清单可随机，不参与。
   */
  function shuffleWallpaper(): 'gradient' | 'none' {
    const gradient = pickDifferent(WALLPAPER_GRADIENTS.map(item => item.value), settings.value.gradient)
    if (!gradient)
      return 'none'
    update({ source: 'gradient', gradient, imageUrl: '' })
    return 'gradient'
  }

  function openPanel() {
    panelVisible.value = true
  }

  function closePanel() {
    panelVisible.value = false
  }

  watch(isAdmin, (value) => {
    // 换身份要加载另一份设置。这次替换是程序行为、不是用户编辑，不该产生写盘；
    // 而防抖窗口比 nextTick 长得多 —— 光靠 skipPersist 在 nextTick 里复位是拦不住的
    // （复位时定时器还没到点，到点时 skipPersist 已经是 false 了），
    // 所以这里先把待写清掉，并把 skipPersist 的复位推迟到窗口之后。
    skipPersist = true
    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = undefined
    }
    settings.value = loadSettings(value)
    purgeLegacyKeys(value)
    nextTick(() => {
      apply()
      setTimeout(() => {
        skipPersist = false
      }, PERSIST_DEBOUNCE_MS + 100)
    })
  })

  watch(settings, () => {
    schedulePersist()
    apply()
  }, { deep: true })

  // 关页面前把待写的设置落盘，否则防抖窗口内的改动会丢
  if (typeof window !== 'undefined')
    window.addEventListener('beforeunload', flushPersist)

  apply()

  // 清掉旧版本留下的、已下线能力的字段（本地图片的 base64 最多能占 1~2MB 配额）。
  // 放在 apply() 之后：此时 settings 已经是迁移过的值，写回去的就是干净数据。
  purgeLegacyKeys(isAdmin.value)

  return {
    settings,
    panelVisible,
    isAdmin,
    update,
    // 供 App.vue 在启动时把壁纸变量注入 DOM；此前遗漏导出会导致 setup 抛错、整页白屏
    apply,
    setImageUrl,
    setGradient,
    removeWallpaper,
    reset,
    openPanel,
    closePanel,
    shuffleWallpaper,
  }
})
