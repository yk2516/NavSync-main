import type { WallpaperSettings } from '@/types'
import { readStore, writeStore } from '@/utils'

const STORAGE_KEY_ADMIN = 'wallpaper_admin'
const STORAGE_KEY_VIEWER = 'wallpaper_viewer'

/** 图标基准尺寸：面板里 100% 对应 64px，与站点卡片原始尺寸一致 */
export const ICON_BASE_SIZE = 64

/**
 * 设置写盘的合并窗口（ms）。
 * 拖滑块会每帧触发一次改动，而 localStorage 是同步写、且设置里可能躺着 1~2MB 的 base64，
 * 不合并的话拖动会直接卡住。窗口内的改动合并成一次写入，关页面前由 `beforeunload` 兜底落盘。
 */
const PERSIST_DEBOUNCE_MS = 300

/**
 * 预设皮肤。
 *
 * `group` 只用于面板分组展示（基础 / 清新 / 明亮 / 深色 / 品牌），不影响渲染；
 * **分组顺序 = 这里的键序**，所以新增皮肤要放到对应分组的末尾。
 * 「清新」排在深色前面是有意的：导航页是图标密集版面，浅底柔和色才是默认该看到的选项。
 * `background` 直接写进 html 的 `--wallpaper-skin`（见 styles/public.scss 的壁纸层说明），
 * 因此必须是**纯 CSS 值**：只有渐变和纯色，没有图片、没有网络请求 —— 这是皮肤能做到
 * 「点一下下一帧就变」的原因（对比图片壁纸的「下载 + 解码」）。
 *
 * ⚠️ 皮肤的亮度会参与明暗自适应（见 apply() → syncTone），深色皮肤在浅色主题下
 * 会自动把文字翻成浅色。新增皮肤后**必须真实渲染验证一次**：浅色主题 + 深色皮肤，
 * 首页文字应可读。`default` 是唯一不设背景的皮肤（交给主题底色）。
 */
const SKINS: Record<string, { label: string; group: string; background: string }> = {
  // ---------------- 基础 ----------------
  // default 不设背景：交给 html 的主题底色（--bg-c / 暗色 --dark-bg-c），
  // 否则暗色模式下会被这里的亮色写死，且不透明背景会盖住壁纸层。
  default: { label: '默认', group: '基础', background: 'none' },

  // ---------------- 清新 ----------------
  // 导航页是「图标 + 文字」的密集版面，用户会长时间停在这一屏 —— 背景太深（黑墙）
  // 或太白（刺眼）都难受。这一组刻意取**低饱和 + 中高明度**的柔和色：
  // 白天不晃眼、夜里不压抑，白天黑夜同一套都成立。
  // 明度都压在自适应翻转线（0.42）之上，因此始终是「浅底深字」，
  // 站点图标与站名永远是最清楚的那一层。
  mistWhite: { label: '月白', group: '清新', background: 'linear-gradient(160deg, #eef3f9 0%, #dfe8f3 100%)' },
  dawnMist: { label: '晨雾', group: '清新', background: 'linear-gradient(160deg, #e6eef7 0%, #d8e4f2 55%, #ece6f4 100%)' },
  seaSalt: { label: '海盐', group: '清新', background: 'linear-gradient(150deg, #cfeaee 0%, #d6e2f7 100%)' },
  mintMilk: { label: '薄荷奶', group: '清新', background: 'linear-gradient(150deg, #d5f0e7 0%, #cfe6f7 100%)' },
  bamboo: { label: '竹青', group: '清新', background: 'linear-gradient(150deg, #d9efdf 0%, #c8e5ea 100%)' },
  skyMist: { label: '天青雾', group: '清新', background: 'linear-gradient(150deg, #d3e7fa 0%, #e4f0fb 100%)' },
  sakura: { label: '樱雪', group: '清新', background: 'linear-gradient(150deg, #fbe2ea 0%, #efe1f8 100%)' },
  lotus: { label: '藕荷', group: '清新', background: 'linear-gradient(150deg, #eae1f6 0%, #e0ddf8 100%)' },
  taro: { label: '香芋', group: '清新', background: 'linear-gradient(150deg, #e2d6f8 0%, #efe3f7 100%)' },
  oatMilk: { label: '燕麦', group: '清新', background: 'linear-gradient(150deg, #f7efe1 0%, #eee3d2 100%)' },
  celadon: { label: '青瓷', group: '清新', background: 'linear-gradient(150deg, #d3eae4 0%, #c6e0dd 100%)' },
  dusk: { label: '薄暮', group: '清新', background: 'linear-gradient(150deg, #f5e5d6 0%, #e0d6f0 100%)' },
  smokeBlue: { label: '烟灰蓝', group: '清新', background: 'linear-gradient(150deg, #c7d6e8 0%, #dde6f1 100%)' },
  daiQing: { label: '黛青', group: '清新', background: 'linear-gradient(150deg, #bcd5d2 0%, #d5e4e1 100%)' },
  matcha: { label: '抹茶', group: '清新', background: 'linear-gradient(150deg, #cfe0c4 0%, #e7eeda 100%)' },
  mistRose: { label: '藕粉', group: '清新', background: 'linear-gradient(150deg, #eed3de 0%, #f3e5ec 100%)' },

  // ---------------- 明亮 ----------------
  clear: { label: '干净明亮', group: '明亮', background: 'linear-gradient(135deg, #ffffff 0%, #e8eef7 100%)' },
  ios: { label: 'iOS 屏半', group: '明亮', background: 'linear-gradient(90deg, #f8fafc 0 50%, #17191f 50%)' },
  material: { label: 'Material 粉', group: '明亮', background: 'linear-gradient(135deg, #f8e9ee 0%, #ffffff 100%)' },
  paper: { label: '纸白', group: '明亮', background: 'linear-gradient(135deg, #ffffff 0%, #f4f6f8 100%)' },
  ivory: { label: '象牙白', group: '明亮', background: 'linear-gradient(135deg, #fffdf7 0%, #f5efe2 100%)' },
  mint: { label: '薄荷', group: '明亮', background: 'linear-gradient(135deg, #f2fdf6 0%, #d8f3e3 100%)' },
  sky: { label: '天青', group: '明亮', background: 'linear-gradient(135deg, #f4fbff 0%, #dcecfb 100%)' },
  sand: { label: '暖沙', group: '明亮', background: 'linear-gradient(135deg, #fffaf0 0%, #f6e7cd 100%)' },

  // ---------------- 深色 ----------------
  midnight: { label: '午夜黑', group: '深色', background: 'linear-gradient(135deg, #090b12 0%, #202333 100%)' },
  deepBlue: { label: '沉静蓝', group: '深色', background: 'linear-gradient(135deg, #111827 0%, #1e293b 100%)' },
  graphite: { label: '石墨灰', group: '深色', background: 'linear-gradient(135deg, #1b1b1d 0%, #34343a 100%)' },
  slate: { label: '石板', group: '深色', background: 'linear-gradient(135deg, #1e232b 0%, #39414d 100%)' },
  navy: { label: '深海蓝', group: '深色', background: 'linear-gradient(135deg, #0a1930 0%, #16385f 100%)' },
  polarGreen: { label: '极光青', group: '深色', background: 'linear-gradient(135deg, #0f2a2e 0%, #173b3b 100%)' },
  forest: { label: '松林', group: '深色', background: 'linear-gradient(135deg, #0c1f16 0%, #1d4430 100%)' },
  starPurple: { label: '星云紫', group: '深色', background: 'linear-gradient(135deg, #211a34 0%, #3b285f 100%)' },
  wine: { label: '酒红', group: '深色', background: 'linear-gradient(135deg, #2a0d16 0%, #4d1526 100%)' },
  warmBrown: { label: '余烬棕', group: '深色', background: 'linear-gradient(135deg, #2c2019 0%, #4b2f1f 100%)' },
  coffee: { label: '咖啡', group: '深色', background: 'linear-gradient(135deg, #1f1712 0%, #3d2b1f 100%)' },

  // ---------------- 品牌 ----------------
  // 取自各家产品界面的公开主色调，命名只作配色来源的描述。
  githubDark: { label: 'GitHub 暗夜', group: '品牌', background: 'linear-gradient(135deg, #0d1117 0%, #161b22 60%, #21262d 100%)' },
  vscode: { label: 'VS Code 深蓝', group: '品牌', background: 'linear-gradient(135deg, #1e1e1e 0%, #252526 60%, #0e639c 100%)' },
  discord: { label: 'Discord 靛蓝', group: '品牌', background: 'linear-gradient(135deg, #1a1c20 0%, #2c2f33 60%, #404eed 100%)' },
  spotify: { label: 'Spotify 黑绿', group: '品牌', background: 'linear-gradient(135deg, #121212 0%, #0f2a1c 70%, #1db954 100%)' },
  netflix: { label: 'Netflix 影院红', group: '品牌', background: 'linear-gradient(135deg, #141414 0%, #2b0a0a 70%, #e50914 100%)' },
  vercel: { label: 'Vercel 黑白', group: '品牌', background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)' },
  notion: { label: 'Notion 墨白', group: '品牌', background: 'linear-gradient(135deg, #191919 0%, #2f2f2f 100%)' },
  slack: { label: 'Slack 茄紫', group: '品牌', background: 'linear-gradient(135deg, #1d1c1d 0%, #3f0e40 100%)' },
  apple: { label: 'Apple 深空灰', group: '品牌', background: 'linear-gradient(135deg, #1c1c1e 0%, #3a3a3c 100%)' },
  tencent: { label: '腾讯深蓝', group: '品牌', background: 'linear-gradient(135deg, #0b1c3d 0%, #0f4c9e 100%)' },
  bilibili: { label: '哔哩粉', group: '品牌', background: 'linear-gradient(135deg, #16162a 0%, #3d1b3d 70%, #fb7299 100%)' },
  xiaomi: { label: '米橙', group: '品牌', background: 'linear-gradient(135deg, #1c1208 0%, #3a2408 70%, #ff6900 100%)' },
}

/**
 * 渐变壁纸预设：一键可用的现成配色，给「高级壁纸 → 渐变」当选项用。
 *
 * 与皮肤的区别是层次与定位：皮肤写在 html 底色上（最底层，低调基调），
 * 渐变写在 body::after（图片之上，直接当壁纸用）。两边都用纯 CSS，零请求。
 *
 * 分两组：「清新柔和」低饱和、明度在翻转线之上，导航页长时间停留不累；
 * 「强对比」用于想要强烈视觉冲击的场合。`group` 只影响面板分组，不参与渲染。
 */
export const WALLPAPER_GRADIENTS: { label: string; group: string; value: string }[] = [
  // ---------------- 清新柔和 ----------------
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

  // ---------------- 强对比 ----------------
  { label: '落日熔金', group: '强对比', value: 'linear-gradient(135deg, #ff6b35 0%, #f7c59f 40%, #6a0572 100%)' },
  { label: '赛博霓虹', group: '强对比', value: 'linear-gradient(135deg, #fc00ff 0%, #00dbde 100%)' },
  { label: '冰火', group: '强对比', value: 'linear-gradient(135deg, #ff0844 0%, #00c6ff 100%)' },
  { label: '霓虹紫青', group: '强对比', value: 'linear-gradient(135deg, #8a2be2 0%, #00e5ff 100%)' },
  { label: '烈焰', group: '强对比', value: 'linear-gradient(135deg, #f12711 0%, #f5af19 100%)' },
  { label: '极光', group: '强对比', value: 'linear-gradient(135deg, #00d2ff 0%, #3a47d5 100%)' },
  { label: '糖果', group: '强对比', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { label: '青柠', group: '强对比', value: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
  { label: '黄昏', group: '强对比', value: 'linear-gradient(135deg, #2c3e50 0%, #fd746c 100%)' },
  { label: '深海', group: '强对比', value: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
  { label: '葡萄', group: '强对比', value: 'linear-gradient(135deg, #654ea3 0%, #eaafc8 100%)' },
  { label: '矩阵绿', group: '强对比', value: 'linear-gradient(135deg, #000000 0%, #0f9b0f 100%)' },
  { label: '皇家蓝', group: '强对比', value: 'linear-gradient(135deg, #141e30 0%, #243b55 100%)' },
  { label: '蜜桃', group: '强对比', value: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)' },
]

const DEFAULTS: WallpaperSettings = {
  skin: 'default',
  accent: '#0071e3',
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

/**
 * 已下线能力在 localStorage 里留下的字段。
 *
 * 「本地图片」存的是 base64（单张可达几百 KB，`recentImages` 还留 4 张）、
 * 壁纸文件夹名、壁纸源 id —— 这些都不再被读取，但会**一直占着 localStorage 配额**
 * （5MB 级别，且是同源共享）。`loadSettings()` 只在内存里把它们折掉、不写回，
 * 所以需要单独清一次。
 */
const LEGACY_WALLPAPER_KEYS = ['image', 'recentImages', 'imageSource', 'customSource', 'folderName']

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

    // ⚠️ 这里**逐字段白名单**构造，绝不写 `{ ...DEFAULTS, ...parsed }`。
    //
    // `parsed` 是**用户存储里的原始对象**，里面可能躺着已下线能力的字段：
    // 本地图片的 base64（`image` 单张可达几百 KB、`recentImages` 还留 4 张）、
    // 壁纸文件夹名、壁纸源 id。展开它 = 这些字段会跟着 settings 一起被写回
    // localStorage，于是每次 persist 都要同步序列化 1~2MB —— 正是 2026-09-20
    // 那轮「写盘防抖」要修掉的开销，等于白修。
    // 未知键一律丢弃（与 `stores/setting.ts` 的 `pickKnownSettings()` 同一原则）。
    return {
      skin: typeof parsed.skin === 'string' ? parsed.skin : DEFAULTS.skin,
      accent: typeof parsed.accent === 'string' ? parsed.accent : DEFAULTS.accent,
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
      // 布局字段是后加的，旧数据里没有；即便有也可能是脏值，统一在这里夹到合法区间，
      // 否则 0 列 / NaN 会让网格塌成一条线，而面板滑块也会显示成怪值。
      layoutRows: clamp(parsed.layoutRows, 1, 6, DEFAULTS.layoutRows),
      layoutCols: clamp(parsed.layoutCols, 2, 8, DEFAULTS.layoutCols),
      layoutColGap: clamp(parsed.layoutColGap, 0, 80, DEFAULTS.layoutColGap),
      layoutRowGap: clamp(parsed.layoutRowGap, 0, 80, DEFAULTS.layoutRowGap),
      searchWidth: clamp(parsed.searchWidth, 260, 900, DEFAULTS.searchWidth),
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

export const wallpaperSkins = SKINS

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
   * 优先级：图片 > 渐变壁纸 > 皮肤 —— 三者按 z-index 从高到低，以最上面那层为准。
   * 用 key 去重，避免拖滑块时每次都重新解码整张图。
   *
   * 皮肤必须参与：深色皮肤配浅色主题时，文字若不翻白就是黑底黑字。
   * （`default` 皮肤的背景是 `none`，传进来是空串，行为与从前一致。）
   */
  function syncTone(image: string, gradient: string, skin: string) {
    const autoDim = settings.value.autoDim
    const surface = image
      ? `img:${image.length}:${image.slice(-48)}`
      : (gradient ? `g:${gradient}` : (skin ? `s:${skin}` : 'none'))
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
    const skin = SKINS[current.skin] || SKINS.default
    // 本地图片 / 文件夹 / 壁纸源已下线，现在只可能来自外链 URL
    const image = current.source === 'url' ? current.imageUrl : ''

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
    // 皮肤也要参与明暗判定：它铺在 html 上，是「没有图片/渐变壁纸时」唯一的底色
    syncTone(
      image,
      current.source === 'gradient' ? current.gradient : '',
      skin.background === 'none' ? '' : skin.background,
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

  function setSkin(skin: string) {
    update({ skin, source: 'none', imageUrl: '', gradient: '' })
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
   * 小风车：随机换一套皮肤或渐变壁纸，返回换了哪一种。
   *
   * 为什么不再是「随机换一张图片」：本地图片 / 壁纸文件夹 / 壁纸源网站已按用户要求移除。
   * 皮肤与渐变都是纯 CSS —— 零请求、零解码，点下去下一帧就变，这才是「秒开」的做法。
   *
   * 皮肤与渐变各 50% 概率：两种都算「壁纸」，都该有机会被抽到。
   * 抽到 `default` 皮肤（背景 none，交主题底色）是合法结果，不特殊处理。
   */
  function shuffleWallpaper(): 'skin' | 'gradient' | 'none' {
    const useSkin = Math.random() < 0.5
    if (useSkin) {
      const key = pickDifferent(Object.keys(SKINS), settings.value.skin)
      if (!key)
        return 'none'
      update({ skin: key, source: 'none', imageUrl: '', gradient: '' })
      return 'skin'
    }
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
    setSkin,
    setImageUrl,
    setGradient,
    removeWallpaper,
    reset,
    openPanel,
    closePanel,
    shuffleWallpaper,
  }
})
